using System;
using UnityEngine;

[Serializable]
public struct LargeWorldTransformState
{
    public LargeWorldVector3d absolutePosition;
    public LargeWorldVector3d absoluteVelocity;
    public Vector3 localUnityPosition;
    public Quaternion rotation;
    public Vector3 angularVelocity;

    public LargeWorldTransformState(
        LargeWorldVector3d absolutePosition,
        LargeWorldVector3d absoluteVelocity,
        Vector3 localUnityPosition,
        Quaternion rotation,
        Vector3 angularVelocity)
    {
        this.absolutePosition = absolutePosition;
        this.absoluteVelocity = absoluteVelocity;
        this.localUnityPosition = localUnityPosition;
        this.rotation = rotation;
        this.angularVelocity = angularVelocity;
    }

    public static LargeWorldTransformState FromTransform(Transform transform, Rigidbody body, LargeWorldVector3d origin)
    {
        Vector3 localPosition = transform != null ? transform.position : Vector3.zero;
        Quaternion rotation = transform != null ? transform.rotation : Quaternion.identity;
        Vector3 linearVelocity = body != null ? body.linearVelocity : Vector3.zero;
        Vector3 angularVelocity = body != null ? body.angularVelocity : Vector3.zero;

        return new LargeWorldTransformState(
            origin + localPosition,
            LargeWorldVector3d.FromVector3(linearVelocity),
            localPosition,
            rotation,
            angularVelocity);
    }
}
