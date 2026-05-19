using UnityEngine;

[RequireComponent(typeof(Camera))]
public class SimpleFollowCamera : MonoBehaviour
{
    [SerializeField] private Transform target;
    [SerializeField] private ShipStats targetStats;

    [Range(10f, 25f)]
    [SerializeField] private float distance = 16f;
    [Range(3f, 10f)]
    [SerializeField] private float height = 6f;

    [SerializeField] private float positionSmooth = 8f;
    [SerializeField] private float rotationSmooth = 10f;
    [SerializeField] private float mouseOrbitSensitivity = 0.18f;
    [SerializeField] private float minPitch = -20f;
    [SerializeField] private float maxPitch = 75f;

    private int cameraMode;
    private bool snapNextFrame;
    private float orbitYaw;
    private float orbitPitch;

    public int CameraMode => cameraMode;
    public float OrbitYaw => orbitYaw;
    public float OrbitPitch => orbitPitch;

    public void BindTarget(Transform newTarget, ShipStats stats)
    {
        target = newTarget;
        targetStats = stats;
        snapNextFrame = true;
    }

    private void Update()
    {
        var keyboard = UnityEngine.InputSystem.Keyboard.current;
        if (keyboard != null)
        {
            if (keyboard.vKey.wasPressedThisFrame)
            {
                cameraMode = (cameraMode + 1) % 3;
                snapNextFrame = true;
            }

            if (keyboard.backquoteKey.wasPressedThisFrame)
            {
                ResetOrbit();
            }
        }

        var mouse = UnityEngine.InputSystem.Mouse.current;
        if (mouse != null && mouse.rightButton.isPressed)
        {
            Vector2 mouseDelta = mouse.delta.ReadValue();
            orbitYaw += mouseDelta.x * mouseOrbitSensitivity;
            orbitPitch = Mathf.Clamp(orbitPitch - mouseDelta.y * mouseOrbitSensitivity, minPitch, maxPitch);
        }
    }

    private void LateUpdate()
    {
        if (target == null)
        {
            return;
        }

        float followDistance = distance;
        float followHeight = height;

        if (targetStats != null)
        {
            followDistance = targetStats.FollowDistance;
            followHeight = targetStats.FollowHeight;
        }

        Vector3 desiredPosition = GetDesiredPosition(followDistance, followHeight);
        float positionBlend = snapNextFrame ? 1f : 1f - Mathf.Exp(-positionSmooth * Time.deltaTime);
        transform.position = Vector3.Lerp(transform.position, desiredPosition, positionBlend);

        Vector3 lookTarget = GetLookTarget();
        Vector3 direction = lookTarget - transform.position;
        if (direction.sqrMagnitude > 0.01f)
        {
            Quaternion targetRotation = Quaternion.LookRotation(direction, GetLookUp());
            float rotationBlend = snapNextFrame ? 1f : 1f - Mathf.Exp(-rotationSmooth * Time.deltaTime);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, rotationBlend);
        }

        snapNextFrame = false;
    }

    private Vector3 GetDesiredPosition(float followDistance, float followHeight)
    {
        if (cameraMode == 1)
        {
            Quaternion orbit = Quaternion.AngleAxis(orbitYaw, Vector3.up) * Quaternion.AngleAxis(orbitPitch, Vector3.right);
            return target.position + orbit * new Vector3(0f, followHeight * 1.4f, -followDistance * 1.25f);
        }

        if (cameraMode == 2)
        {
            Quaternion orbit = Quaternion.AngleAxis(orbitYaw, Vector3.up) * Quaternion.AngleAxis(orbitPitch, Vector3.right);
            return target.position + orbit * new Vector3(-followDistance * 0.9f, followHeight, 0f);
        }

        Vector3 chaseOffset = (-target.forward * followDistance) + (target.up * followHeight);
        if (Mathf.Approximately(orbitYaw, 0f) && Mathf.Approximately(orbitPitch, 0f))
        {
            return target.position + chaseOffset;
        }

        Quaternion lookOffset = Quaternion.AngleAxis(orbitYaw, target.up) * Quaternion.AngleAxis(orbitPitch, target.right);
        return target.position + lookOffset * chaseOffset;
    }

    private Vector3 GetLookTarget()
    {
        return target.position + target.forward * 1.5f;
    }

    private Vector3 GetLookUp()
    {
        return cameraMode == 0 ? target.up : Vector3.up;
    }

    private void ResetOrbit()
    {
        cameraMode = 0;
        orbitYaw = 0f;
        orbitPitch = 0f;
        snapNextFrame = true;
    }
}
