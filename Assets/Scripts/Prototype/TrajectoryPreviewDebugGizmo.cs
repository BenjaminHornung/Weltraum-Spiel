using UnityEngine;

[DisallowMultipleComponent]
[RequireComponent(typeof(ShipPhysicsCore))]
public class TrajectoryPreviewDebugGizmo : MonoBehaviour
{
    [Header("Prediction")]
    [SerializeField] private bool previewEnabled = true;
    [SerializeField] private int stepCount = 120;
    [SerializeField] private float fixedDeltaTime = TrajectoryPredictor.DefaultFixedDeltaTime;
    [SerializeField] private bool includeCentralGravity = true;

    [Header("Gizmo")]
    [SerializeField] private bool drawSelectedGizmo = true;
    [SerializeField] private Color trajectoryColor = new Color(0.2f, 0.85f, 1f, 0.85f);

    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private ShipStats shipStats;

    public bool PreviewEnabled => previewEnabled;
    public int StepCount => Mathf.Clamp(stepCount, 0, TrajectoryPredictor.MaxStepCount);
    public float FixedDeltaTime => fixedDeltaTime > 0f ? fixedDeltaTime : TrajectoryPredictor.DefaultFixedDeltaTime;
    public bool IncludeCentralGravity => includeCentralGravity;
    public TrajectoryPredictionState[] LastPreviewStates { get; private set; } = new TrajectoryPredictionState[0];

    private void Awake()
    {
        ResolveReferences();
    }

    public int RefreshPreview()
    {
        ResolveReferences();
        if (!previewEnabled || physicsCore == null || physicsCore.ShipRigidbody == null)
        {
            LastPreviewStates = new TrajectoryPredictionState[0];
            return 0;
        }

        TrajectoryPredictionState initialState = TrajectoryPredictionState.FromRigidbody(physicsCore.ShipRigidbody, shipStats);
        var settings = new TrajectoryPredictionSettings(StepCount, FixedDeltaTime, includeCentralGravity);
        LastPreviewStates = TrajectoryPredictor.Predict(initialState, physicsCore, settings);
        return LastPreviewStates.Length;
    }

    private void OnDrawGizmosSelected()
    {
        if (!drawSelectedGizmo || RefreshPreview() < 2)
        {
            return;
        }

        Color previousColor = Gizmos.color;
        Gizmos.color = trajectoryColor;
        for (int i = 1; i < LastPreviewStates.Length; i++)
        {
            Gizmos.DrawLine(LastPreviewStates[i - 1].position, LastPreviewStates[i].position);
        }

        Gizmos.color = previousColor;
    }

    private void ResolveReferences()
    {
        if (physicsCore == null)
        {
            TryGetComponent(out physicsCore);
        }

        if (shipStats == null)
        {
            TryGetComponent(out shipStats);
        }
    }

    private void OnValidate()
    {
        stepCount = Mathf.Clamp(stepCount, 0, TrajectoryPredictor.MaxStepCount);
        fixedDeltaTime = fixedDeltaTime > 0f ? fixedDeltaTime : TrajectoryPredictor.DefaultFixedDeltaTime;
    }
}
