using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using Weltraum.Simulation;

namespace Weltraum.Navigation
{
    [Serializable]
    public enum TargetKind
    {
        Unknown = 0,
        Position = 1,
        Vessel = 2,
        Station = 3,
        DockingPort = 4,
        LandingZone = 5,
        Waypoint = 6
    }

    [Serializable]
    public enum NavigationFrameKind
    {
        Unknown = 0,
        World = 1,
        Local = 2,
        Relative = 3,
        VesselRelative = 4
    }

    [Serializable]
    public enum RouteOptimizationMode
    {
        Unknown = 0,
        Direct = 1,
        ObstacleAware = 2,
        FuelConservative = 3,
        BrakeConservative = 4,
        Balanced = 5
    }

    [Serializable]
    public enum RouteRiskLevel
    {
        Unknown = 0,
        Low = 1,
        Moderate = 2,
        High = 3,
        Critical = 4
    }

    [Serializable]
    public enum SegmentKind
    {
        Unknown = 0,
        Cruise = 1,
        Brake = 2,
        Hold = 3,
        Align = 4,
        Approach = 5,
        Evade = 6,
        Transfer = 7
    }

    [Serializable]
    public enum ObstacleKind
    {
        Unknown = 0,
        Static = 1,
        Moving = 2,
        Hazard = 3,
        Structure = 4,
        Debris = 5
    }

    [Serializable]
    public enum AuthorityState
    {
        Unknown = 0,
        Ready = 1,
        Limited = 2,
        Unavailable = 3,
        Blocked = 4
    }

    [Serializable]
    public enum PlanInvalidationReason
    {
        None = 0,
        TargetChanged = 1,
        ArrivalEnvelopeChanged = 2,
        EnvironmentChanged = 3,
        ObstacleChanged = 4,
        AuthorityChanged = 5,
        FuelChanged = 6,
        SegmentFailed = 7,
        ExternalOverride = 8
    }

    [Serializable]
    public sealed class ArrivalEnvelope : IEquatable<ArrivalEnvelope>
    {
        public ArrivalEnvelope(float positionToleranceMeters, float speedToleranceMetersPerSecond, float angularSpeedToleranceDegreesPerSecond, float holdDurationSeconds)
        {
            PositionToleranceMeters = ContractValidation.EnsureFiniteAtLeast(positionToleranceMeters, 0.01f, nameof(positionToleranceMeters));
            SpeedToleranceMetersPerSecond = ContractValidation.EnsureFiniteNonNegative(speedToleranceMetersPerSecond, nameof(speedToleranceMetersPerSecond));
            AngularSpeedToleranceDegreesPerSecond = ContractValidation.EnsureFiniteNonNegative(angularSpeedToleranceDegreesPerSecond, nameof(angularSpeedToleranceDegreesPerSecond));
            HoldDurationSeconds = ContractValidation.EnsureFiniteNonNegative(holdDurationSeconds, nameof(holdDurationSeconds));
        }

        public float PositionToleranceMeters { get; }

        public float SpeedToleranceMetersPerSecond { get; }

        public float AngularSpeedToleranceDegreesPerSecond { get; }

        public float HoldDurationSeconds { get; }

        public bool Equals(ArrivalEnvelope other)
        {
            return other != null
                   && PositionToleranceMeters == other.PositionToleranceMeters
                   && SpeedToleranceMetersPerSecond == other.SpeedToleranceMetersPerSecond
                   && AngularSpeedToleranceDegreesPerSecond == other.AngularSpeedToleranceDegreesPerSecond
                   && HoldDurationSeconds == other.HoldDurationSeconds;
        }

        public override bool Equals(object obj)
        {
            return obj is ArrivalEnvelope other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + PositionToleranceMeters.GetHashCode();
                hash = hash * 31 + SpeedToleranceMetersPerSecond.GetHashCode();
                hash = hash * 31 + AngularSpeedToleranceDegreesPerSecond.GetHashCode();
                hash = hash * 31 + HoldDurationSeconds.GetHashCode();
                return hash;
            }
        }
    }

    [Serializable]
    public sealed class RouteScore : IEquatable<RouteScore>
    {
        public RouteScore(float distanceMeters, float fuelCost, float riskScore, float authorityPenalty)
        {
            DistanceMeters = ContractValidation.EnsureFiniteNonNegative(distanceMeters, nameof(distanceMeters));
            FuelCost = ContractValidation.EnsureFiniteNonNegative(fuelCost, nameof(fuelCost));
            RiskScore = ContractValidation.EnsureFiniteNonNegative(riskScore, nameof(riskScore));
            AuthorityPenalty = ContractValidation.EnsureFiniteNonNegative(authorityPenalty, nameof(authorityPenalty));
        }

        public float DistanceMeters { get; }

        public float FuelCost { get; }

        public float RiskScore { get; }

        public float AuthorityPenalty { get; }

        public bool Equals(RouteScore other)
        {
            return other != null
                   && DistanceMeters == other.DistanceMeters
                   && FuelCost == other.FuelCost
                   && RiskScore == other.RiskScore
                   && AuthorityPenalty == other.AuthorityPenalty;
        }

        public override bool Equals(object obj)
        {
            return obj is RouteScore other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + DistanceMeters.GetHashCode();
                hash = hash * 31 + FuelCost.GetHashCode();
                hash = hash * 31 + RiskScore.GetHashCode();
                hash = hash * 31 + AuthorityPenalty.GetHashCode();
                return hash;
            }
        }
    }

    [Serializable]
    public sealed class RouteSegment : IEquatable<RouteSegment>
    {
        public RouteSegment(SegmentKind segmentKind, SpatialVector3 startPosition, SpatialVector3 endPosition, float distanceMeters, float durationSeconds)
        {
            if (segmentKind == SegmentKind.Unknown)
            {
                throw new ArgumentOutOfRangeException(nameof(segmentKind), segmentKind, "Segment kind must be specified.");
            }

            SegmentKind = segmentKind;
            StartPosition = startPosition;
            EndPosition = endPosition;
            DistanceMeters = ContractValidation.EnsureFiniteNonNegative(distanceMeters, nameof(distanceMeters));
            DurationSeconds = ContractValidation.EnsureFiniteNonNegative(durationSeconds, nameof(durationSeconds));
        }

        public SegmentKind SegmentKind { get; }

        public SpatialVector3 StartPosition { get; }

        public SpatialVector3 EndPosition { get; }

        public float DistanceMeters { get; }

        public float DurationSeconds { get; }

        public bool Equals(RouteSegment other)
        {
            return other != null
                   && SegmentKind == other.SegmentKind
                   && StartPosition.Equals(other.StartPosition)
                   && EndPosition.Equals(other.EndPosition)
                   && DistanceMeters == other.DistanceMeters
                   && DurationSeconds == other.DurationSeconds;
        }

        public override bool Equals(object obj)
        {
            return obj is RouteSegment other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + SegmentKind.GetHashCode();
                hash = hash * 31 + StartPosition.GetHashCode();
                hash = hash * 31 + EndPosition.GetHashCode();
                hash = hash * 31 + DistanceMeters.GetHashCode();
                hash = hash * 31 + DurationSeconds.GetHashCode();
                return hash;
            }
        }
    }

    [Serializable]
    public sealed class TargetDescriptor : IEquatable<TargetDescriptor>
    {
        public TargetDescriptor(TargetKind targetKind, NavigationFrameKind frameKind, SpatialVector3 targetPosition, ArrivalEnvelope arrivalEnvelope, SpatialVector3? desiredVelocity = null, SpatialVector3? desiredAttitude = null)
        {
            if (targetKind == TargetKind.Unknown)
            {
                throw new ArgumentOutOfRangeException(nameof(targetKind), targetKind, "Target kind must be specified.");
            }

            if (frameKind == NavigationFrameKind.Unknown)
            {
                throw new ArgumentOutOfRangeException(nameof(frameKind), frameKind, "Navigation frame must be specified.");
            }

            TargetKind = targetKind;
            FrameKind = frameKind;
            TargetPosition = targetPosition;
            ArrivalEnvelope = arrivalEnvelope ?? throw new ArgumentNullException(nameof(arrivalEnvelope));

            if (desiredAttitude.HasValue && desiredAttitude.Value.IsZero)
            {
                throw new ArgumentOutOfRangeException(nameof(desiredAttitude), desiredAttitude, "Desired attitude must be non-zero when provided.");
            }

            DesiredVelocity = desiredVelocity;
            DesiredAttitude = desiredAttitude;
        }

        public TargetKind TargetKind { get; }

        public NavigationFrameKind FrameKind { get; }

        public SpatialVector3 TargetPosition { get; }

        public SpatialVector3? DesiredVelocity { get; }

        public SpatialVector3? DesiredAttitude { get; }

        public ArrivalEnvelope ArrivalEnvelope { get; }

        public bool Equals(TargetDescriptor other)
        {
            return other != null
                   && TargetKind == other.TargetKind
                   && FrameKind == other.FrameKind
                   && TargetPosition.Equals(other.TargetPosition)
                   && Nullable.Equals(DesiredVelocity, other.DesiredVelocity)
                   && Nullable.Equals(DesiredAttitude, other.DesiredAttitude)
                   && Equals(ArrivalEnvelope, other.ArrivalEnvelope);
        }

        public override bool Equals(object obj)
        {
            return obj is TargetDescriptor other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + TargetKind.GetHashCode();
                hash = hash * 31 + FrameKind.GetHashCode();
                hash = hash * 31 + TargetPosition.GetHashCode();
                hash = hash * 31 + (DesiredVelocity.HasValue ? DesiredVelocity.Value.GetHashCode() : 0);
                hash = hash * 31 + (DesiredAttitude.HasValue ? DesiredAttitude.Value.GetHashCode() : 0);
                hash = hash * 31 + (ArrivalEnvelope != null ? ArrivalEnvelope.GetHashCode() : 0);
                return hash;
            }
        }
    }

    [Serializable]
    public sealed class ObstacleSnapshot : IEquatable<ObstacleSnapshot>
    {
        public ObstacleSnapshot(string id, ObstacleKind obstacleKind, SpatialVector3 position, SpatialVector3 predictedPosition, SpatialVector3 velocity, float hardRadiusMeters, float clearanceRadiusMeters, float hazardScore, float confidence)
        {
            Id = ContractValidation.EnsureNotWhiteSpace(id, nameof(id));

            if (obstacleKind == ObstacleKind.Unknown)
            {
                throw new ArgumentOutOfRangeException(nameof(obstacleKind), obstacleKind, "Obstacle kind must be specified.");
            }

            ObstacleKind = obstacleKind;
            Position = position;
            PredictedPosition = predictedPosition;
            Velocity = velocity;
            HardRadiusMeters = ContractValidation.EnsureFiniteNonNegative(hardRadiusMeters, nameof(hardRadiusMeters));
            ClearanceRadiusMeters = ContractValidation.EnsureFiniteNonNegative(clearanceRadiusMeters, nameof(clearanceRadiusMeters));

            if (ClearanceRadiusMeters < HardRadiusMeters)
            {
                throw new ArgumentOutOfRangeException(nameof(clearanceRadiusMeters), clearanceRadiusMeters, "Clearance radius must be greater than or equal to the hard radius.");
            }

            HazardScore = ContractValidation.EnsureFiniteInRange(hazardScore, 0f, 1f, nameof(hazardScore));
            Confidence = ContractValidation.EnsureFiniteInRange(confidence, 0f, 1f, nameof(confidence));
        }

        public string Id { get; }

        public ObstacleKind ObstacleKind { get; }

        public SpatialVector3 Position { get; }

        public SpatialVector3 PredictedPosition { get; }

        public SpatialVector3 Velocity { get; }

        public float HardRadiusMeters { get; }

        public float ClearanceRadiusMeters { get; }

        public float HazardScore { get; }

        public float Confidence { get; }

        public bool Equals(ObstacleSnapshot other)
        {
            return other != null
                   && string.Equals(Id, other.Id, StringComparison.Ordinal)
                   && ObstacleKind == other.ObstacleKind
                   && Position.Equals(other.Position)
                   && PredictedPosition.Equals(other.PredictedPosition)
                   && Velocity.Equals(other.Velocity)
                   && HardRadiusMeters == other.HardRadiusMeters
                   && ClearanceRadiusMeters == other.ClearanceRadiusMeters
                   && HazardScore == other.HazardScore
                   && Confidence == other.Confidence;
        }

        public override bool Equals(object obj)
        {
            return obj is ObstacleSnapshot other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + StringComparer.Ordinal.GetHashCode(Id);
                hash = hash * 31 + ObstacleKind.GetHashCode();
                hash = hash * 31 + Position.GetHashCode();
                hash = hash * 31 + PredictedPosition.GetHashCode();
                hash = hash * 31 + Velocity.GetHashCode();
                hash = hash * 31 + HardRadiusMeters.GetHashCode();
                hash = hash * 31 + ClearanceRadiusMeters.GetHashCode();
                hash = hash * 31 + HazardScore.GetHashCode();
                hash = hash * 31 + Confidence.GetHashCode();
                return hash;
            }
        }
    }

    [Serializable]
    public sealed class NavigationEnvironmentSnapshot : IEquatable<NavigationEnvironmentSnapshot>
    {
        public NavigationEnvironmentSnapshot(SpatialVector3 referencePosition, SpatialVector3 referenceVelocity, IEnumerable<ObstacleSnapshot> obstacles)
        {
            ReferencePosition = referencePosition;
            ReferenceVelocity = referenceVelocity;
            Obstacles = ContractValidation.CopyToReadOnlyCollection(obstacles, nameof(obstacles), obstacle => obstacle != null, nameof(obstacles));
        }

        public SpatialVector3 ReferencePosition { get; }

        public SpatialVector3 ReferenceVelocity { get; }

        public ReadOnlyCollection<ObstacleSnapshot> Obstacles { get; }

        public bool Equals(NavigationEnvironmentSnapshot other)
        {
            return other != null
                   && ReferencePosition.Equals(other.ReferencePosition)
                   && ReferenceVelocity.Equals(other.ReferenceVelocity)
                   && ContractValidation.SequenceEqual(Obstacles, other.Obstacles);
        }

        public override bool Equals(object obj)
        {
            return obj is NavigationEnvironmentSnapshot other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + ReferencePosition.GetHashCode();
                hash = hash * 31 + ReferenceVelocity.GetHashCode();
                hash = hash * 31 + ContractValidation.SequenceHash(Obstacles);
                return hash;
            }
        }
    }

    [Serializable]
    public sealed class ShipAuthoritySnapshot : IEquatable<ShipAuthoritySnapshot>
    {
        public ShipAuthoritySnapshot(AuthorityState authorityState, float thrustAuthority, float rotationAuthority, float brakeAuthority)
        {
            if (authorityState == AuthorityState.Unknown)
            {
                throw new ArgumentOutOfRangeException(nameof(authorityState), authorityState, "Authority state must be specified.");
            }

            AuthorityState = authorityState;
            ThrustAuthority = ContractValidation.EnsureFiniteInRange(thrustAuthority, 0f, 1f, nameof(thrustAuthority));
            RotationAuthority = ContractValidation.EnsureFiniteInRange(rotationAuthority, 0f, 1f, nameof(rotationAuthority));
            BrakeAuthority = ContractValidation.EnsureFiniteInRange(brakeAuthority, 0f, 1f, nameof(brakeAuthority));
        }

        public AuthorityState AuthorityState { get; }

        public float ThrustAuthority { get; }

        public float RotationAuthority { get; }

        public float BrakeAuthority { get; }

        public bool Equals(ShipAuthoritySnapshot other)
        {
            return other != null
                   && AuthorityState == other.AuthorityState
                   && ThrustAuthority == other.ThrustAuthority
                   && RotationAuthority == other.RotationAuthority
                   && BrakeAuthority == other.BrakeAuthority;
        }

        public override bool Equals(object obj)
        {
            return obj is ShipAuthoritySnapshot other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + AuthorityState.GetHashCode();
                hash = hash * 31 + ThrustAuthority.GetHashCode();
                hash = hash * 31 + RotationAuthority.GetHashCode();
                hash = hash * 31 + BrakeAuthority.GetHashCode();
                return hash;
            }
        }
    }

    [Serializable]
    public sealed class RoutePlan : IEquatable<RoutePlan>
    {
        public RoutePlan(string planHash, TargetDescriptor target, RouteOptimizationMode optimizationMode, RouteRiskLevel riskLevel, RouteScore score, IEnumerable<RouteSegment> segments, IEnumerable<string> diagnostics)
        {
            PlanHash = ContractValidation.EnsureNotWhiteSpace(planHash, nameof(planHash));
            Target = target ?? throw new ArgumentNullException(nameof(target));

            if (optimizationMode == RouteOptimizationMode.Unknown)
            {
                throw new ArgumentOutOfRangeException(nameof(optimizationMode), optimizationMode, "Route optimization mode must be specified.");
            }

            if (riskLevel == RouteRiskLevel.Unknown)
            {
                throw new ArgumentOutOfRangeException(nameof(riskLevel), riskLevel, "Route risk level must be specified.");
            }

            OptimizationMode = optimizationMode;
            RiskLevel = riskLevel;
            Score = score ?? throw new ArgumentNullException(nameof(score));
            Segments = ContractValidation.CopyToReadOnlyCollection(segments, nameof(segments), segment => segment != null, nameof(segments));

            if (Segments.Count == 0)
            {
                throw new ArgumentException("Route plans require at least one segment.", nameof(segments));
            }

            Diagnostics = ContractValidation.CopyToReadOnlyCollection(diagnostics, nameof(diagnostics), diagnostic => !string.IsNullOrWhiteSpace(diagnostic), nameof(diagnostics));
        }

        public string PlanHash { get; }

        public TargetDescriptor Target { get; }

        public RouteOptimizationMode OptimizationMode { get; }

        public RouteRiskLevel RiskLevel { get; }

        public RouteScore Score { get; }

        public ReadOnlyCollection<RouteSegment> Segments { get; }

        public ReadOnlyCollection<string> Diagnostics { get; }

        public bool Equals(RoutePlan other)
        {
            return other != null
                   && string.Equals(PlanHash, other.PlanHash, StringComparison.Ordinal)
                   && Equals(Target, other.Target)
                   && OptimizationMode == other.OptimizationMode
                   && RiskLevel == other.RiskLevel
                   && Equals(Score, other.Score)
                   && ContractValidation.SequenceEqual(Segments, other.Segments)
                   && ContractValidation.SequenceEqual(Diagnostics, other.Diagnostics);
        }

        public override bool Equals(object obj)
        {
            return obj is RoutePlan other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + StringComparer.Ordinal.GetHashCode(PlanHash);
                hash = hash * 31 + (Target != null ? Target.GetHashCode() : 0);
                hash = hash * 31 + OptimizationMode.GetHashCode();
                hash = hash * 31 + RiskLevel.GetHashCode();
                hash = hash * 31 + (Score != null ? Score.GetHashCode() : 0);
                hash = hash * 31 + ContractValidation.SequenceHash(Segments);
                hash = hash * 31 + ContractValidation.SequenceHash(Diagnostics);
                return hash;
            }
        }
    }

    [Serializable]
    public sealed class RouteCandidate : IEquatable<RouteCandidate>
    {
        public RouteCandidate(string candidateName, RouteOptimizationMode optimizationMode, RouteRiskLevel riskLevel, RouteScore score, IEnumerable<RouteSegment> segments, IEnumerable<string> diagnostics, PlanInvalidationReason rejectionReason)
        {
            CandidateName = ContractValidation.EnsureNotWhiteSpace(candidateName, nameof(candidateName));

            if (optimizationMode == RouteOptimizationMode.Unknown)
            {
                throw new ArgumentOutOfRangeException(nameof(optimizationMode), optimizationMode, "Route optimization mode must be specified.");
            }

            if (riskLevel == RouteRiskLevel.Unknown)
            {
                throw new ArgumentOutOfRangeException(nameof(riskLevel), riskLevel, "Route risk level must be specified.");
            }

            OptimizationMode = optimizationMode;
            RiskLevel = riskLevel;
            Score = score ?? throw new ArgumentNullException(nameof(score));
            Segments = ContractValidation.CopyToReadOnlyCollection(segments, nameof(segments), segment => segment != null, nameof(segments));

            if (Segments.Count == 0)
            {
                throw new ArgumentException("Route candidates require at least one segment.", nameof(segments));
            }

            Diagnostics = ContractValidation.CopyToReadOnlyCollection(diagnostics, nameof(diagnostics), diagnostic => !string.IsNullOrWhiteSpace(diagnostic), nameof(diagnostics));
            RejectionReason = rejectionReason;
        }

        public string CandidateName { get; }

        public RouteOptimizationMode OptimizationMode { get; }

        public RouteRiskLevel RiskLevel { get; }

        public RouteScore Score { get; }

        public ReadOnlyCollection<RouteSegment> Segments { get; }

        public ReadOnlyCollection<string> Diagnostics { get; }

        public PlanInvalidationReason RejectionReason { get; }

        public bool Equals(RouteCandidate other)
        {
            return other != null
                   && string.Equals(CandidateName, other.CandidateName, StringComparison.Ordinal)
                   && OptimizationMode == other.OptimizationMode
                   && RiskLevel == other.RiskLevel
                   && Equals(Score, other.Score)
                   && ContractValidation.SequenceEqual(Segments, other.Segments)
                   && ContractValidation.SequenceEqual(Diagnostics, other.Diagnostics)
                   && RejectionReason == other.RejectionReason;
        }

        public override bool Equals(object obj)
        {
            return obj is RouteCandidate other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + StringComparer.Ordinal.GetHashCode(CandidateName);
                hash = hash * 31 + OptimizationMode.GetHashCode();
                hash = hash * 31 + RiskLevel.GetHashCode();
                hash = hash * 31 + (Score != null ? Score.GetHashCode() : 0);
                hash = hash * 31 + ContractValidation.SequenceHash(Segments);
                hash = hash * 31 + ContractValidation.SequenceHash(Diagnostics);
                hash = hash * 31 + RejectionReason.GetHashCode();
                return hash;
            }
        }
    }
}
