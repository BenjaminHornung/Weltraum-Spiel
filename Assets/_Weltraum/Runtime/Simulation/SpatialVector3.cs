using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Weltraum.Simulation
{
    public static class ContractValidation
    {
        public static float EnsureFinite(float value, string parameterName)
        {
            if (float.IsNaN(value) || float.IsInfinity(value))
            {
                throw new ArgumentOutOfRangeException(parameterName, value, "Value must be finite.");
            }

            return value;
        }

        public static float EnsureFiniteNonNegative(float value, string parameterName)
        {
            EnsureFinite(value, parameterName);

            if (value < 0f)
            {
                throw new ArgumentOutOfRangeException(parameterName, value, "Value must be non-negative.");
            }

            return value;
        }

        public static float EnsureFiniteAtLeast(float value, float minimumInclusive, string parameterName)
        {
            EnsureFinite(value, parameterName);

            if (value < minimumInclusive)
            {
                throw new ArgumentOutOfRangeException(parameterName, value, $"Value must be at least {minimumInclusive}.");
            }

            return value;
        }

        public static float EnsureFiniteInRange(float value, float minimumInclusive, float maximumInclusive, string parameterName)
        {
            EnsureFinite(value, parameterName);

            if (value < minimumInclusive || value > maximumInclusive)
            {
                throw new ArgumentOutOfRangeException(parameterName, value, $"Value must be between {minimumInclusive} and {maximumInclusive}.");
            }

            return value;
        }

        public static string EnsureNotWhiteSpace(string value, string parameterName)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException("Value cannot be null, empty, or white space.", parameterName);
            }

            return value;
        }

        public static ReadOnlyCollection<T> CopyToReadOnlyCollection<T>(IEnumerable<T> source, string parameterName, Func<T, bool> itemValidator = null, string itemParameterName = null)
        {
            if (source == null)
            {
                throw new ArgumentNullException(parameterName);
            }

            var items = new List<T>();
            foreach (var item in source)
            {
                if (itemValidator != null && !itemValidator(item))
                {
                    throw new ArgumentException("Collection contains an invalid item.", itemParameterName ?? parameterName);
                }

                items.Add(item);
            }

            return items.AsReadOnly();
        }

        public static bool SequenceEqual<T>(IReadOnlyList<T> left, IReadOnlyList<T> right)
        {
            if (ReferenceEquals(left, right))
            {
                return true;
            }

            if (left == null || right == null || left.Count != right.Count)
            {
                return false;
            }

            var comparer = EqualityComparer<T>.Default;
            for (var index = 0; index < left.Count; index++)
            {
                if (!comparer.Equals(left[index], right[index]))
                {
                    return false;
                }
            }

            return true;
        }

        public static int SequenceHash<T>(IReadOnlyList<T> values)
        {
            unchecked
            {
                var hash = 17;
                if (values != null)
                {
                    var comparer = EqualityComparer<T>.Default;
                    for (var index = 0; index < values.Count; index++)
                    {
                        hash = hash * 31 + comparer.GetHashCode(values[index]);
                    }
                }

                return hash;
            }
        }
    }

    [Serializable]
    public readonly struct SpatialVector3 : IEquatable<SpatialVector3>
    {
        public SpatialVector3(float x, float y, float z)
        {
            X = ContractValidation.EnsureFinite(x, nameof(x));
            Y = ContractValidation.EnsureFinite(y, nameof(y));
            Z = ContractValidation.EnsureFinite(z, nameof(z));
        }

        public float X { get; }

        public float Y { get; }

        public float Z { get; }

        public float MagnitudeSquared => X * X + Y * Y + Z * Z;

        public bool IsZero => X == 0f && Y == 0f && Z == 0f;

        public bool Equals(SpatialVector3 other)
        {
            return X == other.X && Y == other.Y && Z == other.Z;
        }

        public override bool Equals(object obj)
        {
            return obj is SpatialVector3 other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + X.GetHashCode();
                hash = hash * 31 + Y.GetHashCode();
                hash = hash * 31 + Z.GetHashCode();
                return hash;
            }
        }

        public static bool operator ==(SpatialVector3 left, SpatialVector3 right)
        {
            return left.Equals(right);
        }

        public static bool operator !=(SpatialVector3 left, SpatialVector3 right)
        {
            return !left.Equals(right);
        }
    }
}
