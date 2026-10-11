# Freigegebener W09-Transportslot

Der Nutzer hat am 2026-10-11 um 19:54:17.321634 UTC den engen Transportvertrag ausdrücklich angenommen: „Diesen engen Transportvertrag freigeben“. Der ursprüngliche Vorschlag bleibt mit SHA256 `c1aa59de0a2159e7ec2c81af5bd64f5c7d867751e0af274736e737fc26803a6c` unverändert archiviert; sein damaliger Reviewstatus beschreibt die Zeit vor dieser Antwort. Die aktuelle Freigabe steht in `source-lock.json`, D11 und W09.

Der Vertrag erlaubt einen wiederverwendbaren Transportowner mit höchstens fünf Collidern. Eine Bodenablage macht denselben Owner fest. Der Slot bleibt bis zum vollständigen Verbrauch oder einer legalen lokalen Übergabe belegt. Eine weitere belegte Ablage neben einem neuen Träger ist damit nicht vorgesehen. Leere historische Resourcecontainer und Receipts dürfen erhalten bleiben; sie benötigen keine zusätzlichen physischen Depotkörper.

Nach abgeschlossener Übergabe darf der freie Slot für den nächsten gebundenen Job wiederverwendet werden. Ein lebenslang unveränderter Rapierhandle ist keine Vorgabe; Recovery muss ohnehin neue Handles binden. Ein stabiler logischer Carrierowner ist die einfachste Umsetzung. Auch während Staging gelten höchstens 16 Factoryowner einschließlich Cargo und Carrier und die bestehenden Gesamtbudgets.

Dies konkretisiert die bereits angenommene Slotregel und erteilt keine neue Produktfreigabe. Historischer Replay mit identischen vollständigen Commandbytes muss den gespeicherten Receipt liefern; veränderte Bytes oder aktuelle Revisionen dürfen keinen zweiten Pickup aus einem alten Receipt auslösen. Tatsächliche native Depot-, Membership-, Material-, Save- und Browsergates bleiben bis zur jeweiligen Ausführung offen.
