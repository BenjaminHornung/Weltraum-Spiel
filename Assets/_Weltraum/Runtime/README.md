# Runtime Assembly Layout

This folder defines the Clean-Core runtime assemblies.

Dependency rules:

| Assembly | References |
| --- | --- |
| `Weltraum.Core` | none |
| `Weltraum.Simulation` | `Weltraum.Core` |
| `Weltraum.Flight` | `Weltraum.Core`, `Weltraum.Simulation` |
| `Weltraum.Navigation` | `Weltraum.Core`, `Weltraum.Simulation`, `Weltraum.Flight` |
| `Weltraum.UI` | `Weltraum.Core` |
| `Weltraum.Map` | `Weltraum.Core` |
| `Weltraum.ShipBuilder` | `Weltraum.Core` |
| `Weltraum.CargoResources` | `Weltraum.Core` |
| `Weltraum.World` | `Weltraum.Core`, `Weltraum.Simulation` |
| `Weltraum.Combat` | `Weltraum.Core` |
| `Weltraum.Missions` | `Weltraum.Core` |
| `Weltraum.FactionsEconomy` | `Weltraum.Core` |
| `Weltraum.Drones` | `Weltraum.Core` |
| `Weltraum.Persistence` | `Weltraum.Core` |

Contract assemblies are a future slice. UI and Map intentionally depend only on Core for now so they do not reach into navigation, flight, or other internals.
