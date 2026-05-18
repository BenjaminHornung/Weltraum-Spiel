using UnityEngine;

[RequireComponent(typeof(Camera))]
public class SimpleFollowCamera : MonoBehaviour
{
    [SerializeField] private Transform target;
    [SerializeField] private ShipStats targetStats;

    [Range(10f, 15f)]
    [SerializeField] private float distance = 12f;
    [Range(3f, 5f)]
    [SerializeField] private float height = 4f;

    [SerializeField] private float positionSmooth = 8f;
    [SerializeField] private float rotationSmooth = 10f;

    public void BindTarget(Transform newTarget, ShipStats stats)
    {
        target = newTarget;
        targetStats = stats;
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

        Vector3 desiredPosition = target.position - (target.forward * followDistance) + (Vector3.up * followHeight);
        transform.position = Vector3.Lerp(transform.position, desiredPosition, 1f - Mathf.Exp(-positionSmooth * Time.deltaTime));

        Vector3 direction = target.position - transform.position;
        if (direction.sqrMagnitude > 0.01f)
        {
            Quaternion targetRotation = Quaternion.LookRotation(direction, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, 1f - Mathf.Exp(-rotationSmooth * Time.deltaTime));
        }
    }
}
