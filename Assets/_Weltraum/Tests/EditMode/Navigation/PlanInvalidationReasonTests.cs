using NUnit.Framework;
using Weltraum.Navigation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class PlanInvalidationReasonTests
    {
        [Test]
        public void None_IsTheDefaultZeroValue()
        {
            Assert.That((int)PlanInvalidationReason.None, Is.EqualTo(0));
            Assert.That(default(PlanInvalidationReason), Is.EqualTo(PlanInvalidationReason.None));
        }

        [Test]
        public void KnownReasons_AreStableAndNonZero()
        {
            Assert.That((int)PlanInvalidationReason.TargetChanged, Is.GreaterThan(0));
            Assert.That((int)PlanInvalidationReason.ExternalOverride, Is.GreaterThan(0));
        }
    }
}
