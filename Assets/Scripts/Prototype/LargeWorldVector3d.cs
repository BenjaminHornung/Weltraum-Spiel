using System;
using UnityEngine;

[Serializable]
public struct LargeWorldVector3d : IEquatable<LargeWorldVector3d>
{
    public double x;
    public double y;
    public double z;

    public LargeWorldVector3d(double x, double y, double z)
    {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public static LargeWorldVector3d Zero => new LargeWorldVector3d(0d, 0d, 0d);

    public double SqrMagnitude => x * x + y * y + z * z;
    public double Magnitude => Math.Sqrt(SqrMagnitude);

    public LargeWorldVector3d Normalized
    {
        get
        {
            double magnitude = Magnitude;
            return magnitude > double.Epsilon ? this / magnitude : Zero;
        }
    }

    public Vector3 ToVector3()
    {
        return new Vector3((float)x, (float)y, (float)z);
    }

    public static LargeWorldVector3d FromVector3(Vector3 value)
    {
        return new LargeWorldVector3d(value.x, value.y, value.z);
    }

    public bool Equals(LargeWorldVector3d other)
    {
        return x.Equals(other.x) && y.Equals(other.y) && z.Equals(other.z);
    }

    public override bool Equals(object obj)
    {
        return obj is LargeWorldVector3d other && Equals(other);
    }

    public override int GetHashCode()
    {
        unchecked
        {
            int hashCode = x.GetHashCode();
            hashCode = (hashCode * 397) ^ y.GetHashCode();
            hashCode = (hashCode * 397) ^ z.GetHashCode();
            return hashCode;
        }
    }

    public override string ToString()
    {
        return $"({x:0.000}, {y:0.000}, {z:0.000})";
    }

    public static LargeWorldVector3d operator +(LargeWorldVector3d left, LargeWorldVector3d right)
    {
        return new LargeWorldVector3d(left.x + right.x, left.y + right.y, left.z + right.z);
    }

    public static LargeWorldVector3d operator -(LargeWorldVector3d left, LargeWorldVector3d right)
    {
        return new LargeWorldVector3d(left.x - right.x, left.y - right.y, left.z - right.z);
    }

    public static LargeWorldVector3d operator +(LargeWorldVector3d left, Vector3 right)
    {
        return new LargeWorldVector3d(left.x + right.x, left.y + right.y, left.z + right.z);
    }

    public static LargeWorldVector3d operator -(LargeWorldVector3d left, Vector3 right)
    {
        return new LargeWorldVector3d(left.x - right.x, left.y - right.y, left.z - right.z);
    }

    public static LargeWorldVector3d operator *(LargeWorldVector3d value, double scalar)
    {
        return new LargeWorldVector3d(value.x * scalar, value.y * scalar, value.z * scalar);
    }

    public static LargeWorldVector3d operator *(double scalar, LargeWorldVector3d value)
    {
        return value * scalar;
    }

    public static LargeWorldVector3d operator /(LargeWorldVector3d value, double scalar)
    {
        return new LargeWorldVector3d(value.x / scalar, value.y / scalar, value.z / scalar);
    }

    public static double Distance(LargeWorldVector3d left, LargeWorldVector3d right)
    {
        return (left - right).Magnitude;
    }
}
