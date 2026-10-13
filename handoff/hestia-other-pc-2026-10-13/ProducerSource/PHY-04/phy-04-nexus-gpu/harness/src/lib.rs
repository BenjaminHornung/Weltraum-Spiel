//! Finite real Nexus WebGPU candidate. Uncompiled until the documented build prerequisites exist.
use khal::backend::{Backend, GpuBackend, WebGpu};
use nexus_rbd3d::math::{Pose, Vector};
use nexus_rbd3d::pipeline::{RbdCapacities, RbdPipeline, RbdState};
use nexus_rbd3d::rapier::prelude::*;
use nexus_rbd3d::shaders::dynamics::RbdSimParams;
use wasm_bindgen::prelude::*;
use web_time::Instant;
use std::sync::{Arc, Mutex};

fn error(value: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&value.to_string())
}

/// Returns six combined wall-time fields then per-body [x,y,z,vx,vy,vz]; see browser-runner.mjs.
/// No timer in this interface is a GPU pass timer. Each call creates one isolated environment.
#[wasm_bindgen]
pub async fn run_fixture(
    runner_slot: bool,
    count: u32,
    zero_gravity: bool,
    dynamic_geometry: bool,
    velocities_x: Vec<f32>,
    destroy_at_tick: Option<u32>,
) -> Result<Vec<f32>, JsValue> {
    if !runner_slot {
        return Err(error("RUNNER_SLOT_REQUIRED"));
    }
    if !matches!(count, 10 | 100 | 1000)
        || velocities_x.len() != count as usize
        || velocities_x.iter().any(|v| !v.is_finite() || v.abs() > 1.0)
        || (dynamic_geometry && count != 10)
        || destroy_at_tick.is_some_and(|tick| tick != 5 || count != 10)
    {
        return Err(error("FINITE_FIXTURE_REQUIRED"));
    }
    let begin = Instant::now();
    // Backend errors propagate; no CPU fallback, same-session solver switch or synthetic outputs.
    let gpu = WebGpu::default().await.map_err(error)?;
    let lost = Arc::new(Mutex::new(None::<String>));
    let callback_lost = lost.clone();
    gpu.device().set_device_lost_callback(move |reason, message| {
        *callback_lost.lock().unwrap() = Some(format!("{reason:?}:{message}"));
    });
    let backend = GpuBackend::WebGpu(gpu);
    let pipeline = RbdPipeline::new(&backend).map_err(error)?;
    let mut bodies = RigidBodySet::new();
    let mut colliders = ColliderSet::new();
    let impulse_joints = ImpulseJointSet::new();
    let multibody_joints = MultibodyJointSet::new();
    let mut handles = Vec::new();
    let mut collider_handles = Vec::new();
    for (id, vx) in velocities_x.iter().enumerate() {
        let handle = bodies.insert(
            RigidBodyBuilder::dynamic()
                .translation(Vector::new((id % 32) as f32 * 4.0, 10.0, (id / 32) as f32 * 4.0))
                .linvel(Vector::new(*vx, 0.0, 0.0))
                .can_sleep(false),
        );
        let co = colliders.insert_with_parent(
            ColliderBuilder::cuboid(0.25, 0.5, 0.75).mass(2.0),
            handle,
            &mut bodies,
        );
        handles.push(handle);
        collider_handles.push(co);
        bodies[handle].enable_gyroscopic_forces(false);
    }
    let params = RbdSimParams::default();
    let capacity = RbdCapacities {
        batches: 1,
        body_capacity: count,
        collisions_capacity: count * 8,
        ..Default::default()
    };
    let setup_ms = begin.elapsed().as_secs_f32() * 1000.0;
    let upload_start = Instant::now();
    let mut state = RbdState::from_rapier(
        &backend,
        &[(&bodies, &colliders, &impulse_joints, &multibody_joints, &params)],
        capacity,
    );
    state.set_gravity(&backend, if zero_gravity { [0.0; 3] } else { [0.0, -9.81, 0.0] });
    state.set_deterministic(&backend, true);
    let upload_ms = upload_start.elapsed().as_secs_f32() * 1000.0;
    let mut encode_submit_ms = 0.0;
    let mut geometry_rebuild_ms = 0.0;
    for tick in 0..30 {
        if let Some(reason) = lost.lock().unwrap().as_ref() {
            return Err(error(format!("DEVICE_LOST:{reason}")));
        }
        if destroy_at_tick == Some(tick) {
            if let GpuBackend::WebGpu(gpu) = &backend {
                gpu.device().destroy();
            }
            return Err(error("DEVICE_DESTROY_REQUESTED_DEVICELOSS_ACK_NOT_PROVEN"));
        }
        if dynamic_geometry && tick == 10 {
            let rebuild = Instant::now();
            // Geometry rebuild reads the current state first; no pose snap or reset to the original fixture.
            let poses: Vec<Pose> = backend.slow_read_vec(state.body_poses().buffer()).await.map_err(error)?;
            let velocities: Vec<nexus_rbd3d::Velocity> = backend.slow_read_vec(state.vels().buffer()).await.map_err(error)?;
            for id in 0..count as usize {
                bodies[handles[id]].set_position(poses[id], true);
                bodies[handles[id]].set_linvel(velocities[id].linear, true);
                bodies[handles[id]].set_angvel(velocities[id].angular, true);
            }
            colliders[collider_handles[0]].set_shape(SharedShape::cuboid(0.125, 0.5, 0.75));
            colliders[collider_handles[0]].set_mass(2.0);
            bodies[handles[0]].recompute_mass_properties_from_colliders(&colliders);
            state = RbdState::from_rapier(
                &backend,
                &[(&bodies, &colliders, &impulse_joints, &multibody_joints, &params)],
                capacity,
            );
            state.set_gravity(&backend, if zero_gravity { [0.0; 3] } else { [0.0, -9.81, 0.0] });
            state.set_deterministic(&backend, true);
            geometry_rebuild_ms += rebuild.elapsed().as_secs_f32() * 1000.0;
        }
        let step_start = Instant::now();
        pipeline.step(&backend, &mut state, None).map_err(error)?;
        pipeline.auto_resize_buffers(&backend, &mut state).map_err(error)?;
        encode_submit_ms += step_start.elapsed().as_secs_f32() * 1000.0;
    }
    let readback = Instant::now();
    let poses: Vec<Pose> = backend.slow_read_vec(state.body_poses().buffer()).await.map_err(error)?;
    let velocities: Vec<nexus_rbd3d::Velocity> = backend.slow_read_vec(state.vels().buffer()).await.map_err(error)?;
    let readback_ms = readback.elapsed().as_secs_f32() * 1000.0;
    if let Some(reason) = lost.lock().unwrap().as_ref() {
        return Err(error(format!("DEVICE_LOST:{reason}")));
    }
    let total_ms = begin.elapsed().as_secs_f32() * 1000.0;
    let mut output = vec![setup_ms, upload_ms, encode_submit_ms, readback_ms, geometry_rebuild_ms, total_ms];
    for id in 0..count as usize {
        let p = poses[id].translation;
        let v = velocities[id].linear;
        output.extend_from_slice(&[p.x, p.y, p.z, v.x, v.y, v.z]);
    }
    // Rust ownership drops this entire backend/state; genuine device loss/restart needs the runner's browser probe.
    Ok(output)
}
