using UnityEngine;
using UnityEngine.InputSystem;

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
[RequireComponent(typeof(MainThrusterModule))]
[RequireComponent(typeof(RcsThrusterController))]
public class PlayerShipController : MonoBehaviour
{
    [Header("Flight tuning")]
    [SerializeField] private float stabilizeRate = 2.5f;
    [SerializeField] private float brakeRate = 4f;
    [SerializeField] private float mouseSensitivity = 0.12f;
    [SerializeField] private float keyboardAttitudeStrength = 1f;
    [SerializeField] private float gamepadLookSpeed = 1.6f;
    [SerializeField] private float gamepadLookDeadZone = 0.18f;

    [Header("Main Throttle")]
    [Range(0f, 1f)]
    [SerializeField] private float mainThrottle;
    [SerializeField] private float throttleChangeRate = 0.65f;

    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private GunModule gunModule;
    [SerializeField] private EngineVfxController engineVfx;
    [SerializeField] private MainThrusterModule mainThruster;
    [SerializeField] private RcsThrusterController rcsThrusters;

    private bool throttleUp;
    private bool throttleDown;
    private bool fire;
    private bool refuel;
    private bool resetVelocity;
    private bool stabilize;
    private Vector2 rcsTranslationInput;
    private Vector3 attitudeInput;
    private float previousSpeed;

    public float MainThrottle => mainThrottle;
    public float MainThrottlePercent => mainThrottle * 100f;
    public float MainThrustCommand { get; private set; }
    public Vector2 RcsTranslationCommand { get; private set; }
    public Vector3 RcsAttitudeCommand { get; private set; }
    public float TurnInput { get; private set; }
    public float GimbalYawCommand { get; private set; }
    public bool GimbalEnabled => mainThruster != null && mainThruster.SupportsGimbal;
    public float GimbalLimitDegrees => mainThruster != null ? mainThruster.GimbalLimitDegrees : 0f;
    public float LastGimbalAngleDegrees => mainThruster != null ? mainThruster.LastGimbalAngleDegrees : 0f;
    public Vector3 LastMainThrustDirection => mainThruster != null ? mainThruster.LastAppliedDirection : transform.forward;
    public float LastMainAppliedThrust => mainThruster != null ? mainThruster.LastAppliedThrust : 0f;
    public Vector3 LastMainForceWorld => mainThruster != null ? mainThruster.LastForceWorld : Vector3.zero;
    public Vector3 LastMainForcePositionWorld => mainThruster != null ? mainThruster.LastForcePositionWorld : transform.position;
    public Vector3 LastMainGimbalTorque => mainThruster != null ? mainThruster.LastEstimatedTorque : Vector3.zero;
    public bool HasRcs => rcsThrusters != null && rcsThrusters.HasRcs;
    public Vector3 RcsControlPivotLocal => rcsThrusters != null ? rcsThrusters.ControlPivotLocal : Vector3.zero;
    public Vector3 RcsControlPivotWorld => rcsThrusters != null ? rcsThrusters.ControlPivotWorld : transform.position;
    public Vector3 LastRcsForce => rcsThrusters != null ? rcsThrusters.LastForceAtPositionTotal : Vector3.zero;
    public Vector3 LastRcsTorque => rcsThrusters != null ? rcsThrusters.LastTorque : Vector3.zero;
    public Vector3 LastRcsYawTorque => rcsThrusters != null ? rcsThrusters.LastYawTorqueEstimate : Vector3.zero;

    private void Awake()
    {
        ResolveReferences();
        ConfigureRigidbody();
    }

    private void ResolveReferences()
    {
        if (shipRigidbody == null)
        {
            shipRigidbody = GetComponent<Rigidbody>();
        }

        if (shipStats == null)
        {
            shipStats = GetComponent<ShipStats>();
        }

        if (gunModule == null)
        {
            gunModule = GetComponent<GunModule>();
        }

        if (engineVfx == null)
        {
            engineVfx = GetComponent<EngineVfxController>();
        }

        if (mainThruster == null)
        {
            mainThruster = GetComponent<MainThrusterModule>();
        }

        if (rcsThrusters == null)
        {
            rcsThrusters = GetComponent<RcsThrusterController>();
        }
    }

    private void ConfigureRigidbody()
    {
        if (shipRigidbody == null)
        {
            return;
        }

        shipRigidbody.useGravity = false;
        shipRigidbody.linearDamping = 0.05f;
        shipRigidbody.angularDamping = 3.5f;
        shipRigidbody.interpolation = RigidbodyInterpolation.Interpolate;
    }

    private void Update()
    {
        if (shipRigidbody == null || shipStats == null || gunModule == null || engineVfx == null || mainThruster == null || rcsThrusters == null)
        {
            ResolveReferences();
            ConfigureRigidbody();
            if (shipRigidbody == null || shipStats == null)
            {
                return;
            }
        }

        PollInput();
        UpdateMainThrottle(Time.deltaTime);
        HandleUtilityInputs();

        if (fire)
        {
            if (gunModule == null)
            {
                ResolveReferences();
            }

            if (gunModule != null)
            {
                gunModule.TryFire();
            }
        }
    }

    private void FixedUpdate()
    {
        if (shipRigidbody == null || shipStats == null || mainThruster == null || rcsThrusters == null)
        {
            ResolveReferences();
            if (shipRigidbody == null || shipStats == null)
            {
                return;
            }
        }

        shipRigidbody.mass = shipStats.CurrentMass;

        RcsTranslationCommand = Vector2.ClampMagnitude(rcsTranslationInput, 1f);
        RcsAttitudeCommand = Vector3.ClampMagnitude(attitudeInput, 1f);
        TurnInput = Mathf.Clamp(RcsAttitudeCommand.y, -1f, 1f);

        if (rcsThrusters != null)
        {
            rcsThrusters.ApplyControls(RcsTranslationCommand, RcsAttitudeCommand, stabilize, Time.fixedDeltaTime);
        }

        MainThrustCommand = Mathf.Clamp01(mainThrottle);
        GimbalYawCommand = MainThrustCommand > 0f && GimbalEnabled ? TurnInput : 0f;
        float gimbalPitchCommand = MainThrustCommand > 0f && GimbalEnabled ? Mathf.Clamp(RcsAttitudeCommand.x, -1f, 1f) : 0f;

        float appliedThrust = 0f;
        if (mainThruster != null)
        {
            appliedThrust = mainThruster.Fire(MainThrustCommand, GimbalYawCommand, gimbalPitchCommand, Time.fixedDeltaTime);
        }

        if (stabilize)
        {
            shipRigidbody.angularVelocity = Vector3.Lerp(shipRigidbody.angularVelocity, Vector3.zero, stabilizeRate * Time.fixedDeltaTime);
            shipRigidbody.linearVelocity = Vector3.Lerp(shipRigidbody.linearVelocity, Vector3.zero, brakeRate * Time.fixedDeltaTime);
        }

        float acceleration = 0f;
        if (Time.fixedDeltaTime > 0.0001f)
        {
            acceleration = (shipRigidbody.linearVelocity.magnitude - previousSpeed) / Time.fixedDeltaTime;
        }

        previousSpeed = shipRigidbody.linearVelocity.magnitude;
        shipStats.RecordFlightTelemetry(MainThrustCommand, appliedThrust, acceleration);

        if (engineVfx != null)
        {
            engineVfx.SetThrottle(appliedThrust > 0f ? MainThrustCommand : 0f);
        }
    }

    private void PollInput()
    {
        throttleUp = false;
        throttleDown = false;
        fire = false;
        refuel = false;
        resetVelocity = false;
        stabilize = false;
        rcsTranslationInput = Vector2.zero;
        attitudeInput = Vector3.zero;

        Keyboard keyboard = Keyboard.current;
        Mouse mouse = Mouse.current;
        Gamepad gamepad = Gamepad.current;

        if (keyboard != null)
        {
            throttleUp |= keyboard.wKey.isPressed || keyboard.leftShiftKey.isPressed;
            throttleDown |= keyboard.sKey.isPressed;
            fire |= keyboard.spaceKey.isPressed;
            refuel |= keyboard.rKey.wasPressedThisFrame;
            resetVelocity |= keyboard.tKey.wasPressedThisFrame;
            stabilize |= keyboard.xKey.isPressed;

            if (keyboard.aKey.isPressed)
            {
                attitudeInput.y -= keyboardAttitudeStrength;
            }

            if (keyboard.dKey.isPressed)
            {
                attitudeInput.y += keyboardAttitudeStrength;
            }

            if (keyboard.pageUpKey.isPressed)
            {
                attitudeInput.x += keyboardAttitudeStrength;
            }

            if (keyboard.pageDownKey.isPressed)
            {
                attitudeInput.x -= keyboardAttitudeStrength;
            }

            if (keyboard.qKey.isPressed)
            {
                attitudeInput.z -= keyboardAttitudeStrength;
            }

            if (keyboard.eKey.isPressed)
            {
                attitudeInput.z += keyboardAttitudeStrength;
            }

            if (keyboard.jKey.isPressed || keyboard.leftArrowKey.isPressed)
            {
                rcsTranslationInput.x -= 1f;
            }

            if (keyboard.lKey.isPressed || keyboard.rightArrowKey.isPressed)
            {
                rcsTranslationInput.x += 1f;
            }

            if (keyboard.iKey.isPressed || keyboard.upArrowKey.isPressed)
            {
                rcsTranslationInput.y += 1f;
            }

            if (keyboard.kKey.isPressed || keyboard.downArrowKey.isPressed)
            {
                rcsTranslationInput.y -= 1f;
            }
        }

        if (mouse != null)
        {
            Vector2 mouseDelta = mouse.delta.ReadValue();
            attitudeInput.x += -mouseDelta.y * mouseSensitivity;
            attitudeInput.y += mouseDelta.x * mouseSensitivity;
            fire |= mouse.leftButton.isPressed;
        }

        if (gamepad != null)
        {
            Vector2 left = gamepad.leftStick.ReadValue();
            Vector2 right = gamepad.rightStick.ReadValue();
            float rightTrigger = gamepad.rightTrigger.ReadValue();
            float leftTrigger = gamepad.leftTrigger.ReadValue();

            throttleUp |= rightTrigger > 0.1f;
            throttleDown |= left.y < -gamepadLookDeadZone;
            stabilize |= leftTrigger > 0.1f || gamepad.bButton.isPressed;
            fire |= gamepad.aButton.isPressed;
            refuel |= gamepad.xButton.wasPressedThisFrame;
            resetVelocity |= gamepad.yButton.wasPressedThisFrame;

            if (right.sqrMagnitude > gamepadLookDeadZone * gamepadLookDeadZone)
            {
                attitudeInput.x += -right.y * gamepadLookSpeed;
                attitudeInput.y += right.x * gamepadLookSpeed;
            }

            if (left.sqrMagnitude > gamepadLookDeadZone * gamepadLookDeadZone)
            {
                rcsTranslationInput += left;
            }

            if (gamepad.leftShoulder.isPressed)
            {
                attitudeInput.z -= keyboardAttitudeStrength;
            }

            if (gamepad.rightShoulder.isPressed)
            {
                attitudeInput.z += keyboardAttitudeStrength;
            }
        }
    }

    private void UpdateMainThrottle(float deltaTime)
    {
        float throttleDelta = 0f;
        if (throttleUp)
        {
            throttleDelta += throttleChangeRate * deltaTime;
        }

        if (throttleDown)
        {
            throttleDelta -= throttleChangeRate * deltaTime;
        }

        mainThrottle = Mathf.Clamp01(mainThrottle + throttleDelta);
    }

    private void HandleUtilityInputs()
    {
        if (refuel)
        {
            shipStats.RefillFuelFull();
        }

        if (resetVelocity)
        {
            shipRigidbody.linearVelocity = Vector3.zero;
            shipRigidbody.angularVelocity = Vector3.zero;
        }
    }

    private void OnValidate()
    {
        mainThrottle = Mathf.Clamp01(mainThrottle);
        throttleChangeRate = Mathf.Max(0f, throttleChangeRate);
    }
}
