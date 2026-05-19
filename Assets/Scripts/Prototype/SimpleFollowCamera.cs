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
    [SerializeField] private float anchoredLookYawLimit = 18f;
    [SerializeField] private float anchoredLookPitchLimit = 12f;
    [SerializeField] private float anchoredLookRecenterSpeed = 45f;
    private int cameraMode;
    private bool snapNextFrame;
    private float orbitYaw;
    private float anchorError;
    private float orbitPitch;

    public int CameraMode => cameraMode;
    public string CameraModeName => GetCameraModeName(cameraMode);
    public float AnchorError => anchorError;
    public float LookYaw => cameraMode == 0 ? Mathf.Clamp(orbitYaw, -anchoredLookYawLimit, anchoredLookYawLimit) : orbitYaw;
    public float LookPitch => cameraMode == 0 ? Mathf.Clamp(orbitPitch, -anchoredLookPitchLimit, anchoredLookPitchLimit) : orbitPitch;
    public float OrbitYaw => orbitYaw;
    public float OrbitPitch => orbitPitch;

    public void BindTarget(Transform newTarget, ShipStats stats)
    {
        target = newTarget;
        targetStats = stats;
        snapNextFrame = true;
    }

    public void SnapNextFrame()
    {
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

            if (WasResetPressed(keyboard))
            {
                ResetOrbit();
            }
        }

        var mouse = UnityEngine.InputSystem.Mouse.current;
        bool rightMouseHeld = mouse != null && mouse.rightButton.isPressed;
        if (rightMouseHeld)
        {
            Vector2 mouseDelta = mouse.delta.ReadValue();
            orbitYaw += mouseDelta.x * mouseOrbitSensitivity;
            orbitPitch -= mouseDelta.y * mouseOrbitSensitivity;

            if (cameraMode == 0)
            {
                orbitYaw = Mathf.Clamp(orbitYaw, -anchoredLookYawLimit, anchoredLookYawLimit);
                orbitPitch = Mathf.Clamp(orbitPitch, -anchoredLookPitchLimit, anchoredLookPitchLimit);
            }
            else
            {
                orbitPitch = Mathf.Clamp(orbitPitch, minPitch, maxPitch);
            }
        }
        else if (cameraMode == 0)
        {
            orbitYaw = Mathf.MoveTowards(orbitYaw, 0f, anchoredLookRecenterSpeed * Time.deltaTime);
            orbitPitch = Mathf.MoveTowards(orbitPitch, 0f, anchoredLookRecenterSpeed * Time.deltaTime);
        }
    }

    private void LateUpdate()
    {
        if (target == null)
        {
            anchorError = 0f;
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

        if (cameraMode == 0)
        {
            Quaternion desiredRotation = GetDesiredRotation();
            transform.SetPositionAndRotation(desiredPosition, desiredRotation);
            anchorError = Vector3.Distance(transform.position, desiredPosition);
            snapNextFrame = false;
            return;
        }

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

        anchorError = Vector3.Distance(transform.position, desiredPosition);
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

        return target.position + target.rotation * new Vector3(0f, followHeight, -followDistance);
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


    private Quaternion GetDesiredRotation()
    {
        float lookYaw = Mathf.Clamp(orbitYaw, -anchoredLookYawLimit, anchoredLookYawLimit);
        float lookPitch = Mathf.Clamp(orbitPitch, -anchoredLookPitchLimit, anchoredLookPitchLimit);
        return target.rotation * Quaternion.Euler(lookPitch, lookYaw, 0f);
    }

private static bool WasResetPressed(UnityEngine.InputSystem.Keyboard keyboard)
    {
        return keyboard.backquoteKey.wasPressedThisFrame
            || keyboard.backslashKey.wasPressedThisFrame
            || keyboard.quoteKey.wasPressedThisFrame
            || keyboard.digit3Key.wasPressedThisFrame;
    }

    private static string GetCameraModeName(int mode)
    {
        switch (mode)
        {
            case 0:
                return "ChaseLocked";
            case 1:
                return "Orbit";
            case 2:
                return "Side";
            default:
                return "Unknown";
        }
    }
}
