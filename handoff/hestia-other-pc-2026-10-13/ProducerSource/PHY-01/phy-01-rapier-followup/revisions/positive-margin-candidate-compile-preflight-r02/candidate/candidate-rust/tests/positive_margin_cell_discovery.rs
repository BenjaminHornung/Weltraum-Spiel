// Query regressions for MARGIN01; they do not establish the four historical KCC causes.
use parry3d::math::{IVector, Pose, Vector};
use parry3d::query::{details, DefaultQueryDispatcher, ShapeCastOptions};
use parry3d::shape::{Ball, Cuboid, Voxels};

#[test]
fn discovers_initial_positive_margin_contact_outside_the_geometric_aabb() {
    let size = 0.125;
    let radius = 0.015625;
    let gap = 0.0078125;
    let margin = 0.015625;
    let voxels = Voxels::new(Vector::splat(size), &[IVector::new(0, 0, 0)]);
    let ball = Ball::new(radius);
    let pose = Pose::from_translation(Vector::new(size / 2.0, size + radius + gap, size / 2.0));
    let velocity = Vector::new(0.0009765625, -0.001953125, 0.0);
    let center = voxels.voxel_center(IVector::new(0, 0, 0));
    let relative_pose = Pose::from_translation(center).inverse() * pose;
    let cell = Cuboid::new(Vector::splat(size / 2.0));

    for stop_at_penetration in [false, true] {
        let options = ShapeCastOptions {
            target_distance: margin,
            max_time_of_impact: 1.0,
            stop_at_penetration,
            compute_impact_geometry_on_penetration: true,
        };
        let direct = details::cast_shapes_support_map_support_map(
            &relative_pose, velocity, &cell, &ball, options,
        ).expect("The actual fork narrowphase must see the initial margin contact");
        assert_eq!(direct.time_of_impact, 0.0);
        let voxel = details::cast_shapes_voxels_shape(
            &DefaultQueryDispatcher, &pose, velocity, &voxels, &ball, options,
        ).expect("Voxel discovery must retain the existing margin contact");
        assert_eq!(voxel.time_of_impact, direct.time_of_impact);
    }

    let zero_margin = ShapeCastOptions {
        target_distance: 0.0,
        max_time_of_impact: 1.0,
        stop_at_penetration: true,
        compute_impact_geometry_on_penetration: true,
    };
    assert!(details::cast_shapes_voxels_shape(
        &DefaultQueryDispatcher, &pose, velocity, &voxels, &ball, zero_margin,
    ).is_none(), "The actual displacement does not close the geometric gap");
}

#[test]
fn preserves_separating_initial_margin_policy() {
    let size = 0.125;
    let voxels = Voxels::new(Vector::splat(size), &[IVector::new(0, 0, 0)]);
    let ball = Ball::new(0.015625);
    let pose = Pose::from_translation(Vector::new(size / 2.0, size + 0.015625 + 0.0078125, size / 2.0));
    let away = Vector::new(0.0009765625, 0.001953125, 0.0);
    let options = ShapeCastOptions {
        target_distance: 0.015625,
        max_time_of_impact: 1.0,
        stop_at_penetration: false,
        compute_impact_geometry_on_penetration: true,
    };
    assert!(details::cast_shapes_voxels_shape(
        &DefaultQueryDispatcher, &pose, away, &voxels, &ball, options,
    ).is_none());
}
