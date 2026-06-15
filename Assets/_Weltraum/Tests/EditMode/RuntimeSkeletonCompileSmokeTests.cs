using NUnit.Framework;

namespace Weltraum.Tests.EditMode
{
    public sealed class RuntimeSkeletonCompileSmokeTests
    {
        [Test]
        public void CoreMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Core.CoreAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Core"));
        }

        [Test]
        public void SimulationMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Simulation.SimulationAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Simulation"));
        }

        [Test]
        public void FlightMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Flight.FlightAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Flight"));
        }

        [Test]
        public void NavigationMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Navigation.NavigationAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Navigation"));
        }

        [Test]
        public void UIMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.UI.UIAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.UI"));
        }

        [Test]
        public void MapMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Map.MapAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Map"));
        }

        [Test]
        public void ShipBuilderMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.ShipBuilder.ShipBuilderAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.ShipBuilder"));
        }

        [Test]
        public void CargoResourcesMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.CargoResources.CargoResourcesAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.CargoResources"));
        }

        [Test]
        public void WorldMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.World.WorldAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.World"));
        }

        [Test]
        public void CombatMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Combat.CombatAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Combat"));
        }

        [Test]
        public void MissionsMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Missions.MissionsAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Missions"));
        }

        [Test]
        public void FactionsEconomyMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.FactionsEconomy.FactionsEconomyAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.FactionsEconomy"));
        }

        [Test]
        public void DronesMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Drones.DronesAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Drones"));
        }

        [Test]
        public void PersistenceMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Persistence.PersistenceAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Persistence"));
        }

        [Test]
        public void EditorMarker_UsesExpectedAssemblyName()
        {
            Assert.That(Weltraum.Editor.WeltraumEditorAssemblyMarker.AssemblyName, Is.EqualTo("Weltraum.Editor"));
        }
    }
}
