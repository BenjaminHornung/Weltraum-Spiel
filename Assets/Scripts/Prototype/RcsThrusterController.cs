using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class RcsThrusterController : MonoBehaviour
{
    [Header("RCS Tuning")]
    [SerializeField] private float translationForce = 12000f;
    [SerializeField] private float pitchForce = 7000f;
    [SerializeField] private float yawForce = 7000f;
    [SerializeField] private float rollForce = 6500f;
    [SerializeField] private float stabilizationRate = 2.5f;
    [SerializeField] private Rigidbody shipRigidbody;

    [Header("Installed RCS Thrusters")]
    [SerializeField] private Transform upThruster;
    [SerializeField] private Transform downThruster;
    [SerializeField] private Transform leftThruster;
    [SerializeField] private Transform rightThruster;

    [Header("Translation VFX")]
    [SerializeField] private GameObject upVfx;
    [SerializeField] private GameObject downVfx;
    [SerializeField] private GameObject leftVfx;
    [SerializeField] private GameObject rightVfx;

    public bool HasRcs => upThruster != null || downThruster != null || leftThruster != null || rightThruster != null;
    public Vector3 ControlPivotLocal { get; private set; }
    public Vector3 ControlPivotWorld => transform.TransformPoint(ControlPivotLocal);
    public Vector2 LastTranslationCommand { get; private set; }
    public Vector3 LastAttitudeCommand { get; private set; }
    public Vector3 LastTranslationForce { get; private set; }
    public Vector3 LastTorque { get; private set; }
    public Vector3 LastForceAtPositionTotal { get; private set; }
    public Vector3 LastYawForceWorld { get; private set; }
    public Vector3 LastYawTorqueEstimate { get; private set; }

    private void Awake()
    {
        ResolveReferences();
        ResolveThrusterReferences();
        ResolveVfxReferences();
        RecomputeControlPivot();
        SetTranslationVfx(Vector2.zero);
    }

    public void ConfigureThrusters(Transform up, Transform down, Transform left, Transform right, Rigidbody body)
    {
        upThruster = up != null ? up : upThruster;
        downThruster = down != null ? down : downThruster;
        leftThruster = left != null ? left : leftThruster;
        rightThruster = right != null ? right : rightThruster;
        shipRigidbody = body != null ? body : shipRigidbody;
        ResolveReferences();
        ResolveVfxReferences();
        RecomputeControlPivot();
    }

    private void ResolveReferences()
    {
        if (shipRigidbody == null)
        {
            shipRigidbody = GetComponent<Rigidbody>();
        }
    }

    private void ResolveThrusterReferences()
    {
        upThruster = upThruster != null ? upThruster : transform.Find("RCS_Up");
        downThruster = downThruster != null ? downThruster : transform.Find("RCS_Down");
        leftThruster = leftThruster != null ? leftThruster : transform.Find("RCS_Left");
        rightThruster = rightThruster != null ? rightThruster : transform.Find("RCS_Right");
    }

    private void ResolveVfxReferences()
    {
        if (upVfx == null)
        {
            upVfx = FindChildGameObject("RCS_Up_VFX");
        }

        if (downVfx == null)
        {
            downVfx = FindChildGameObject("RCS_Down_VFX");
        }

        if (leftVfx == null)
        {
            leftVfx = FindChildGameObject("RCS_Left_VFX");
        }

        if (rightVfx == null)
        {
            rightVfx = FindChildGameObject("RCS_Right_VFX");
        }
    }

    private GameObject FindChildGameObject(string childName)
    {
        foreach (Transform child in transform.GetComponentsInChildren<Transform>(true))
        {
            if (child != transform && child.name == childName)
            {
                return child.gameObject;
            }
        }

        return null;
    }

    public void RecomputeControlPivot()
    {
        Vector3 sum = Vector3.zero;
        int count = 0;
        AccumulateLocalPosition(upThruster, ref sum, ref count);
        AccumulateLocalPosition(downThruster, ref sum, ref count);
        AccumulateLocalPosition(leftThruster, ref sum, ref count);
        AccumulateLocalPosition(rightThruster, ref sum, ref count);
        ControlPivotLocal = count > 0 ? sum / count : Vector3.zero;
    }

    private void AccumulateLocalPosition(Transform thruster, ref Vector3 sum, ref int count)
    {
        if (thruster == null)
        {
            return;
        }

        sum += transform.InverseTransformPoint(thruster.position);
        count++;
    }

    public void ApplyControls(Vector2 translationCommand, Vector3 attitudeCommand, bool stabilizeAngular, float deltaTime)
    {
        ResolveReferences();
        ResolveThrusterReferences();
        ResolveVfxReferences();

        LastTranslationCommand = Vector2.ClampMagnitude(translationCommand, 1f);
        LastAttitudeCommand = Vector3.ClampMagnitude(attitudeCommand, 1f);
        LastTranslationForce = Vector3.zero;
        LastTorque = Vector3.zero;
        LastForceAtPositionTotal = Vector3.zero;
        LastYawForceWorld = Vector3.zero;
        LastYawTorqueEstimate = Vector3.zero;

        if (shipRigidbody == null)
        {
            SetTranslationVfx(LastTranslationCommand);
            return;
        }

        if (HasRcs)
        {
            ApplyTranslationForces();
            ApplyAttitudeForces();
        }

        if (stabilizeAngular)
        {
            shipRigidbody.angularVelocity = Vector3.Lerp(shipRigidbody.angularVelocity, Vector3.zero, stabilizationRate * deltaTime);
        }

        SetTranslationVfx(LastTranslationCommand);
    }

    private void ApplyTranslationForces()
    {
        if (LastTranslationCommand.x > 0.05f)
        {
            ApplyForceAtThruster(rightThruster, transform.right * (LastTranslationCommand.x * translationForce));
        }
        else if (LastTranslationCommand.x < -0.05f)
        {
            ApplyForceAtThruster(leftThruster, transform.right * (LastTranslationCommand.x * translationForce));
        }

        if (LastTranslationCommand.y > 0.05f)
        {
            ApplyForceAtThruster(upThruster, transform.up * (LastTranslationCommand.y * translationForce));
        }
        else if (LastTranslationCommand.y < -0.05f)
        {
            ApplyForceAtThruster(downThruster, transform.up * (LastTranslationCommand.y * translationForce));
        }
    }

    private void ApplyAttitudeForces()
    {
        float pitch = LastAttitudeCommand.x;
        float yaw = LastAttitudeCommand.y;
        float roll = LastAttitudeCommand.z;

        if (Mathf.Abs(yaw) > 0.05f)
        {
            Vector3 leftForce = -transform.forward * (yaw * yawForce);
            Vector3 rightForce = transform.forward * (yaw * yawForce);
            ApplyForceAtThruster(leftThruster, leftForce, true);
            ApplyForceAtThruster(rightThruster, rightForce, true);
            LastYawForceWorld = leftForce + rightForce;
        }

        if (Mathf.Abs(pitch) > 0.05f)
        {
            ApplyForceAtThruster(downThruster, transform.forward * (pitch * pitchForce));
            ApplyForceAtThruster(upThruster, -transform.forward * (pitch * pitchForce));
        }

        if (Mathf.Abs(roll) > 0.05f)
        {
            ApplyForceAtThruster(leftThruster, transform.up * (roll * rollForce));
            ApplyForceAtThruster(rightThruster, -transform.up * (roll * rollForce));
        }
    }

    private void ApplyForceAtThruster(Transform thruster, Vector3 forceWorld, bool recordYaw = false)
    {
        if (shipRigidbody == null || forceWorld.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        Vector3 position = thruster != null ? thruster.position : ControlPivotWorld;
        shipRigidbody.AddForceAtPosition(forceWorld, position, ForceMode.Force);
        Vector3 torque = Vector3.Cross(position - shipRigidbody.worldCenterOfMass, forceWorld);
        LastTranslationForce += forceWorld;
        LastForceAtPositionTotal += forceWorld;
        LastTorque += torque;

        if (recordYaw)
        {
            LastYawTorqueEstimate += torque;
        }
    }

    public void SetTranslationVfx(Vector2 command)
    {
        SetActive(upVfx, command.y > 0.05f);
        SetActive(downVfx, command.y < -0.05f);
        SetActive(leftVfx, command.x < -0.05f);
        SetActive(rightVfx, command.x > 0.05f);
    }

    private static void SetActive(GameObject target, bool active)
    {
        if (target != null && target.activeSelf != active)
        {
            target.SetActive(active);
        }
    }

    private void OnValidate()
    {
        translationForce = Mathf.Max(0f, translationForce);
        pitchForce = Mathf.Max(0f, pitchForce);
        yawForce = Mathf.Max(0f, yawForce);
        rollForce = Mathf.Max(0f, rollForce);
        stabilizationRate = Mathf.Max(0f, stabilizationRate);
    }
}
