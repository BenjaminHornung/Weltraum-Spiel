using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

[RequireComponent(typeof(Camera))]
public class PrototypeShipBuilderHud : MonoBehaviour
{
    private const float CanvasReferenceWidth = 1280f;
    private const float CanvasReferenceHeight = 720f;

    private Canvas canvas;
    private CanvasScaler canvasScaler;
    private RectTransform root;
    private TMP_InputField nameInput;
    private TMP_Text dirtyChip;
    private TMP_Text testFlyReason;
    private TMP_Text hintText;
    private TMP_Text gridLevelLabel;
    private TMP_Text moduleCountText;
    private TMP_Text selectionTitle;
    private TMP_Text selectionInfo;
    private TMP_Text validationStatusText;
    private Button saveButton;
    private Button testFlyButton;
    private Button mirrorToggle;
    private RectTransform paletteList;
    private RectTransform validationList;
    private RectTransform loadList;
    private readonly TMP_Text[] statTexts = new TMP_Text[8];
    private PrototypeShipBuilderViewModel lastViewModel;

    public bool IsVisible => canvas != null && canvas.enabled;

    private void Awake()
    {
        EnsureUi();
    }

    public void SetVisible(bool visible)
    {
        EnsureUi();
        canvas.enabled = visible;
    }

    public void ApplySnapshot(PrototypeShipBuilderViewModel viewModel)
    {
        EnsureUi();
        lastViewModel = viewModel ?? new PrototypeShipBuilderViewModel();
        SetTextIfChanged(nameInput != null ? nameInput.textComponent : null, lastViewModel.BlueprintName);
        if (nameInput != null && !nameInput.isFocused && nameInput.text != lastViewModel.BlueprintName)
        {
            nameInput.text = lastViewModel.BlueprintName;
        }

        SetActive(dirtyChip, lastViewModel.IsDirty);
        SetTextIfChanged(dirtyChip, "Nicht gespeichert");
        SetTextIfChanged(testFlyReason, lastViewModel.TestFlyDisabledReason);
        SetActive(testFlyReason, !lastViewModel.CanTestFly);
        SetTextIfChanged(hintText, lastViewModel.HintText);
        SetTextIfChanged(gridLevelLabel, "Ebene Y = " + lastViewModel.GridLevel.ToString("+0.00;-0.00") + " m");
        SetTextIfChanged(moduleCountText, lastViewModel.ModuleCount + " Module");
        SetTextIfChanged(selectionTitle, lastViewModel.SelectionTitle);
        SetTextIfChanged(selectionInfo, lastViewModel.SelectionInfo);
        SetTextIfChanged(validationStatusText, lastViewModel.ValidationStatus);
        if (saveButton != null) saveButton.interactable = lastViewModel.CanSave;
        if (testFlyButton != null) testFlyButton.interactable = lastViewModel.CanTestFly;
        SetButtonText(mirrorToggle, lastViewModel.MirrorX ? "Spiegeln X: EIN" : "Spiegeln X: AUS");

        for (int i = 0; i < statTexts.Length; i++)
        {
            string line = lastViewModel.StatLines != null && i < lastViewModel.StatLines.Length ? lastViewModel.StatLines[i] : string.Empty;
            SetTextIfChanged(statTexts[i], line);
        }

        RebuildPaletteRows(lastViewModel);
        RebuildValidationRows(lastViewModel);
        RebuildLoadRows(lastViewModel);
    }

    public bool HasCompleteStaticBindingsForTests()
    {
        EnsureUi();
        string[] names =
        {
            "ShipBuilderRoot", "ShipBuilderTopBar", "ShipBuilderPalettePanel", "ShipBuilderInfoPanel", "ShipBuilderHintBar",
            "ShipBuilderBlueprintNameInput", "ShipBuilderDirtyChip", "ShipBuilderNewButton", "ShipBuilderLoadButton",
            "ShipBuilderSaveButton", "ShipBuilderTestFlyButton", "ShipBuilderTestFlyReason", "ShipBuilderExitButton",
            "ShipBuilderCategoryTabBar", "ShipBuilderCategoryTab_Cockpit", "ShipBuilderCategoryTab_Hull",
            "ShipBuilderCategoryTab_FuelTank", "ShipBuilderCategoryTab_MainThruster", "ShipBuilderCategoryTab_RcsBlock",
            "ShipBuilderCategoryTab_Gun", "ShipBuilderCategoryTab_Cargo", "ShipBuilderCategoryTab_Utility",
            "ShipBuilderPaletteList", "ShipBuilderMirrorToggle", "ShipBuilderGridLevelLabel", "ShipBuilderStatsBlock",
            "ShipBuilderStat_DryMass", "ShipBuilderStat_Fuel", "ShipBuilderStat_TotalMass", "ShipBuilderStat_Thrust",
            "ShipBuilderStat_Accel", "ShipBuilderStat_DeltaV", "ShipBuilderStat_Rcs", "ShipBuilderStat_Com",
            "ShipBuilderValidationList", "ShipBuilderSelectionBlock", "ShipBuilderSelectionTitle", "ShipBuilderSelectionInfo",
            "ShipBuilderSelectionDeleteButton", "ShipBuilderSelectionDuplicateButton", "ShipBuilderSelectionRotateButton",
            "ShipBuilderHintText", "ShipBuilderLoadOverlay", "ShipBuilderLoadList", "ShipBuilderLoadCloseButton",
            "ShipBuilderConfirmOverlay", "ShipBuilderConfirmText", "ShipBuilderConfirmSaveButton",
            "ShipBuilderConfirmDiscardButton", "ShipBuilderConfirmCancelButton"
        };

        for (int i = 0; i < names.Length; i++)
        {
            if (FindChild(root, names[i]) == null)
            {
                return false;
            }
        }

        return true;
    }

    public void ApplyResponsiveLayoutForTests(int width, int height)
    {
        EnsureUi();
        if (canvasScaler != null)
        {
            canvasScaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
            canvasScaler.scaleFactor = 1f;
        }

        RectTransform canvasRect = canvas.GetComponent<RectTransform>();
        canvasRect.anchorMin = Vector2.zero;
        canvasRect.anchorMax = Vector2.zero;
        canvasRect.pivot = Vector2.zero;
        canvasRect.sizeDelta = new Vector2(width, height);
        canvasRect.anchoredPosition = Vector2.zero;
        ApplyPanelLayout(width);
    }

    public bool IsNameInputFocused()
    {
        return nameInput != null
            && (nameInput.isFocused || EventSystem.current != null && EventSystem.current.currentSelectedGameObject == nameInput.gameObject);
    }

    private void EnsureUi()
    {
        if (canvas != null)
        {
            return;
        }

        if (TryBindExistingUi())
        {
            return;
        }

        GameObject canvasObject = new GameObject("PrototypeShipBuilderHudCanvas");
        canvasObject.transform.SetParent(transform, false);
        canvas = canvasObject.AddComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 40;
        canvas.enabled = false;
        canvasScaler = canvasObject.AddComponent<CanvasScaler>();
        canvasScaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        canvasScaler.referenceResolution = new Vector2(CanvasReferenceWidth, CanvasReferenceHeight);
        canvasScaler.matchWidthOrHeight = 0.5f;
        canvasObject.AddComponent<GraphicRaycaster>();
        EnsureEventSystem();

        root = CreateRect("ShipBuilderRoot", canvasObject.transform, StretchFull());
        CreateLayout(root);
        TryBindExistingUi();
    }

    private bool TryBindExistingUi()
    {
        Canvas[] canvases = GetComponentsInChildren<Canvas>(true);
        for (int i = 0; i < canvases.Length; i++)
        {
            if (canvases[i] != null && canvases[i].gameObject.name == "PrototypeShipBuilderHudCanvas")
            {
                canvas = canvases[i];
                canvasScaler = canvas.GetComponent<CanvasScaler>();
                root = FindChild(canvas.transform, "ShipBuilderRoot") as RectTransform;
                BindFields();
                return root != null;
            }
        }

        return false;
    }

    private void BindFields()
    {
        nameInput = FindComponent<TMP_InputField>("ShipBuilderBlueprintNameInput");
        dirtyChip = FindComponent<TMP_Text>("ShipBuilderDirtyChip");
        saveButton = FindComponent<Button>("ShipBuilderSaveButton");
        testFlyButton = FindComponent<Button>("ShipBuilderTestFlyButton");
        testFlyReason = FindComponent<TMP_Text>("ShipBuilderTestFlyReason");
        hintText = FindComponent<TMP_Text>("ShipBuilderHintText");
        gridLevelLabel = FindComponent<TMP_Text>("ShipBuilderGridLevelLabel");
        moduleCountText = FindComponent<TMP_Text>("ShipBuilderModuleCount");
        selectionTitle = FindComponent<TMP_Text>("ShipBuilderSelectionTitle");
        selectionInfo = FindComponent<TMP_Text>("ShipBuilderSelectionInfo");
        validationStatusText = FindComponent<TMP_Text>("ShipBuilderValidationStatus");
        mirrorToggle = FindComponent<Button>("ShipBuilderMirrorToggle");
        paletteList = FindComponent<RectTransform>("ShipBuilderPaletteList");
        validationList = FindComponent<RectTransform>("ShipBuilderValidationList");
        loadList = FindComponent<RectTransform>("ShipBuilderLoadList");

        string[] statNames = { "DryMass", "Fuel", "TotalMass", "Thrust", "Accel", "DeltaV", "Rcs", "Com" };
        for (int i = 0; i < statNames.Length; i++)
        {
            statTexts[i] = FindComponent<TMP_Text>("ShipBuilderStat_" + statNames[i]);
        }
    }

    private void CreateLayout(RectTransform parent)
    {
        RectTransform topBar = CreatePanel("ShipBuilderTopBar", parent, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 48f), Vector2.zero));
        RectTransform palette = CreatePanel("ShipBuilderPalettePanel", parent, new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(0f, 0.5f), new Vector2(280f, -80f), new Vector2(0f, -8f)));
        RectTransform info = CreatePanel("ShipBuilderInfoPanel", parent, new RectPreset(new Vector2(1f, 0f), new Vector2(1f, 1f), new Vector2(1f, 0.5f), new Vector2(340f, -80f), new Vector2(0f, -8f)));
        RectTransform hint = CreatePanel("ShipBuilderHintBar", parent, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(0f, 32f), Vector2.zero));

        CreateText("ShipBuilderTitle", topBar, "HANGAR", PrototypeUiStyle.HeadlineFontSize, TextAnchor.MiddleLeft, PrototypeUiStyle.TextSecondary, new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(110f, 32f), new Vector2(12f, 0f)));
        nameInput = CreateInput("ShipBuilderBlueprintNameInput", topBar, new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(320f, 32f), new Vector2(128f, 0f)));
        dirtyChip = CreateText("ShipBuilderDirtyChip", topBar, "Nicht gespeichert", PrototypeUiStyle.CaptionFontSize, TextAnchor.MiddleLeft, PrototypeUiStyle.WarningColor, new RectPreset(new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(0f, 0.5f), new Vector2(160f, 24f), new Vector2(460f, 0f)));
        CreateButton("ShipBuilderNewButton", topBar, "Neu", new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(64f, 32f), new Vector2(-386f, 0f)));
        CreateButton("ShipBuilderLoadButton", topBar, "Laden", new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(74f, 32f), new Vector2(-312f, 0f)));
        saveButton = CreateButton("ShipBuilderSaveButton", topBar, "Speichern", new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(90f, 32f), new Vector2(-226f, 0f)));
        testFlyButton = CreateButton("ShipBuilderTestFlyButton", topBar, "Testflug", new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(96f, 32f), new Vector2(-126f, 0f)));
        CreateButton("ShipBuilderExitButton", topBar, "Verlassen", new RectPreset(new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(1f, 0.5f), new Vector2(90f, 32f), new Vector2(-24f, 0f)));

        RectTransform tabBar = CreateRect("ShipBuilderCategoryTabBar", palette, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-24f, 64f), new Vector2(0f, -44f)));
        CreateCategoryTabs(tabBar);
        paletteList = CreateScrollContent("ShipBuilderPaletteList", palette, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(-24f, -154f), new Vector2(0f, 8f)));
        mirrorToggle = CreateButton("ShipBuilderMirrorToggle", palette, "Spiegeln X: AUS", new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-24f, 28f), new Vector2(0f, 42f)));
        CreateText("ShipBuilderPaletteHint", palette, "Q/E Ebene  R drehen  M spiegeln", PrototypeUiStyle.CaptionFontSize, TextAnchor.MiddleCenter, PrototypeUiStyle.TextSecondary, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-24f, 24f), new Vector2(0f, 14f)));

        RectTransform infoContent = CreateScrollContent("ShipBuilderInfoContent", info, StretchFull(10f, 10f));
        RectTransform statsBlock = CreateRect("ShipBuilderStatsBlock", infoContent, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 176f), new Vector2(0f, -88f)));
        string[] statNames = { "DryMass", "Fuel", "TotalMass", "Thrust", "Accel", "DeltaV", "Rcs", "Com" };
        for (int i = 0; i < statNames.Length; i++)
        {
            statTexts[i] = CreateText("ShipBuilderStat_" + statNames[i], statsBlock, string.Empty, PrototypeUiStyle.CaptionFontSize, TextAnchor.MiddleLeft, PrototypeUiStyle.TextPrimary, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-8f, 20f), new Vector2(0f, -10f - (i * 21f))));
        }

        validationStatusText = CreateText("ShipBuilderValidationStatus", infoContent, "OK", PrototypeUiStyle.BodyFontSize, TextAnchor.MiddleLeft, PrototypeUiStyle.TextPrimary, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 24f), new Vector2(0f, -266f)));
        testFlyReason = CreateText("ShipBuilderTestFlyReason", parent, string.Empty, PrototypeUiStyle.MicroFontSize, TextAnchor.MiddleCenter, PrototypeUiStyle.WarningColor, new RectPreset(new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(560f, 20f), new Vector2(0f, -64f)));
        testFlyReason.textWrappingMode = TextWrappingModes.NoWrap;
        validationList = CreateScrollContent("ShipBuilderValidationList", infoContent, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 128f), new Vector2(0f, -302f)));
        RectTransform selectionBlock = CreateRect("ShipBuilderSelectionBlock", infoContent, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 176f), new Vector2(0f, -460f)));
        selectionTitle = CreateText("ShipBuilderSelectionTitle", selectionBlock, "Kein Modul ausgewaehlt", PrototypeUiStyle.CaptionFontSize, TextAnchor.UpperLeft, PrototypeUiStyle.TextPrimary, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-8f, 40f), new Vector2(0f, -22f)));
        selectionInfo = CreateText("ShipBuilderSelectionInfo", selectionBlock, string.Empty, PrototypeUiStyle.CaptionFontSize, TextAnchor.UpperLeft, PrototypeUiStyle.TextSecondary, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-8f, 72f), new Vector2(0f, -82f)));
        CreateButton("ShipBuilderSelectionDeleteButton", selectionBlock, "Loeschen", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(76f, 28f), new Vector2(4f, 16f)));
        CreateButton("ShipBuilderSelectionDuplicateButton", selectionBlock, "Duplizieren", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(94f, 28f), new Vector2(86f, 16f)));
        CreateButton("ShipBuilderSelectionRotateButton", selectionBlock, "Drehen", new RectPreset(new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(76f, 28f), new Vector2(-4f, 16f)));
        SetContentHeight(infoContent, 620f);

        gridLevelLabel = CreateText("ShipBuilderGridLevelLabel", hint, "Ebene Y = +0.00 m", PrototypeUiStyle.CaptionFontSize, TextAnchor.MiddleLeft, PrototypeUiStyle.TextSecondary, new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 1f), new Vector2(0f, 0.5f), new Vector2(180f, 0f), new Vector2(12f, 0f)));
        hintText = CreateText("ShipBuilderHintText", hint, string.Empty, PrototypeUiStyle.CaptionFontSize, TextAnchor.MiddleCenter, PrototypeUiStyle.TextPrimary, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(-420f, 0f), Vector2.zero));
        moduleCountText = CreateText("ShipBuilderModuleCount", hint, "0 Module", PrototypeUiStyle.CaptionFontSize, TextAnchor.MiddleRight, PrototypeUiStyle.TextSecondary, new RectPreset(new Vector2(1f, 0f), new Vector2(1f, 1f), new Vector2(1f, 0.5f), new Vector2(160f, 0f), new Vector2(-12f, 0f)));

        CreateOverlays(parent);
        ApplyPanelLayout(1280);
    }

    private void CreateCategoryTabs(RectTransform parent)
    {
        PrototypeShipModuleCategory[] categories =
        {
            PrototypeShipModuleCategory.Cockpit, PrototypeShipModuleCategory.Hull, PrototypeShipModuleCategory.FuelTank, PrototypeShipModuleCategory.MainThruster,
            PrototypeShipModuleCategory.RcsBlock, PrototypeShipModuleCategory.Gun, PrototypeShipModuleCategory.Cargo, PrototypeShipModuleCategory.Utility
        };
        string[] labels = { "Cockpit", "Huelle", "Tank", "Antrieb", "RCS", "Waffe", "Cargo", "Utility" };
        for (int i = 0; i < categories.Length; i++)
        {
            float x = (i % 4) * 0.25f;
            float y = i < 4 ? 0.5f : 0f;
            CreateButton("ShipBuilderCategoryTab_" + categories[i], parent, labels[i], new RectPreset(new Vector2(x, y), new Vector2(x + 0.25f, y + 0.5f), new Vector2(0.5f, 0.5f), new Vector2(-4f, -4f), Vector2.zero));
        }
    }

    private void CreateOverlays(RectTransform parent)
    {
        RectTransform loadOverlay = CreatePanel("ShipBuilderLoadOverlay", parent, new RectPreset(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(480f, 360f), Vector2.zero));
        CreateText("ShipBuilderLoadTitle", loadOverlay, "Blueprint laden", PrototypeUiStyle.HeadlineFontSize, TextAnchor.UpperLeft, PrototypeUiStyle.TextPrimary, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-24f, 40f), new Vector2(0f, -24f)));
        loadList = CreateScrollContent("ShipBuilderLoadList", loadOverlay, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 0.5f), new Vector2(-24f, -96f), new Vector2(0f, -4f)));
        CreateButton("ShipBuilderLoadCloseButton", loadOverlay, "Schliessen", new RectPreset(new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(108f, 30f), new Vector2(-16f, 20f)));
        loadOverlay.gameObject.SetActive(false);

        RectTransform confirmOverlay = CreatePanel("ShipBuilderConfirmOverlay", parent, new RectPreset(new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(480f, 170f), Vector2.zero));
        CreateText("ShipBuilderConfirmText", confirmOverlay, "\"Blueprint\" hat ungespeicherte Aenderungen.", PrototypeUiStyle.BodyFontSize, TextAnchor.UpperLeft, PrototypeUiStyle.TextPrimary, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-24f, 58f), new Vector2(0f, -42f)));
        CreateButton("ShipBuilderConfirmSaveButton", confirmOverlay, "Speichern", new RectPreset(new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(104f, 30f), new Vector2(18f, 22f)));
        CreateButton("ShipBuilderConfirmDiscardButton", confirmOverlay, "Verwerfen", new RectPreset(new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(0.5f, 0f), new Vector2(116f, 30f), new Vector2(0f, 22f)));
        CreateButton("ShipBuilderConfirmCancelButton", confirmOverlay, "Abbrechen", new RectPreset(new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(112f, 30f), new Vector2(-18f, 22f)));
        confirmOverlay.gameObject.SetActive(false);
    }

    private void RebuildPaletteRows(PrototypeShipBuilderViewModel viewModel)
    {
        ClearChildren(paletteList);
        PrototypeShipBuilderPaletteItemViewModel[] items = viewModel.PaletteItems ?? System.Array.Empty<PrototypeShipBuilderPaletteItemViewModel>();
        for (int i = 0; i < items.Length; i++)
        {
            RectTransform row = CreatePanel("ShipBuilderPaletteCard_" + items[i].DefinitionId, paletteList, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 64f), new Vector2(0f, -32f - (i * 68f))));
            row.gameObject.AddComponent<Button>();
            CreateText(row.name + "_Name", row, items[i].DisplayName, PrototypeUiStyle.CaptionFontSize, TextAnchor.UpperLeft, PrototypeUiStyle.TextPrimary, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(-16f, 28f), new Vector2(8f, -18f)));
            CreateText(row.name + "_Metrics", row, items[i].Metrics, PrototypeUiStyle.MicroFontSize, TextAnchor.LowerLeft, PrototypeUiStyle.TextSecondary, new RectPreset(new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0.5f, 0f), new Vector2(-16f, 26f), new Vector2(8f, 12f)));
        }
        SetContentHeight(paletteList, Mathf.Max(1, items.Length) * 68f);
    }

    private void RebuildValidationRows(PrototypeShipBuilderViewModel viewModel)
    {
        ClearChildren(validationList);
        PrototypeShipBuilderValidationRowViewModel[] rows = viewModel.ValidationRows ?? System.Array.Empty<PrototypeShipBuilderValidationRowViewModel>();
        for (int i = 0; i < rows.Length; i++)
        {
            Color color = rows[i].Severity == PrototypeShipBuilderFindingSeverity.Error ? PrototypeUiStyle.DangerColor : PrototypeUiStyle.WarningColor;
            RectTransform row = CreateRect("ShipBuilderValidationRow_" + i, validationList, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 24f), new Vector2(0f, -12f - (i * 26f))));
            if (rows[i].CanSelectInstance)
            {
                row.gameObject.AddComponent<Button>();
            }
            TMP_Text rowText = CreateText(row.name + "_Text", row, (rows[i].Severity == PrototypeShipBuilderFindingSeverity.Error ? "x " : "! ") + rows[i].Text, PrototypeUiStyle.CaptionFontSize, TextAnchor.MiddleLeft, color, StretchFull(2f, 0f));
            rowText.textWrappingMode = TextWrappingModes.NoWrap;
        }
        SetContentHeight(validationList, Mathf.Max(1, rows.Length) * 26f);
    }

    private void RebuildLoadRows(PrototypeShipBuilderViewModel viewModel)
    {
        ClearChildren(loadList);
        PrototypeShipBuilderLoadRowViewModel[] rows = viewModel.LoadRows ?? System.Array.Empty<PrototypeShipBuilderLoadRowViewModel>();
        for (int i = 0; i < rows.Length; i++)
        {
            RectTransform row = CreatePanel("ShipBuilderLoadRow_" + i, loadList, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 40f), new Vector2(0f, -20f - (i * 42f))));
            if (!rows[i].IsDamaged)
            {
                row.gameObject.AddComponent<Button>();
            }
            string suffix = rows[i].IsDamaged ? " beschaedigt" : rows[i].IsBuiltIn ? " Built-in" : string.Empty;
            CreateText(row.name + "_Text", row, rows[i].Name + suffix, PrototypeUiStyle.CaptionFontSize, TextAnchor.MiddleLeft, rows[i].IsDamaged ? PrototypeUiStyle.DangerColor : PrototypeUiStyle.TextPrimary, StretchFull(8f, 2f));
        }
        SetContentHeight(loadList, Mathf.Max(1, rows.Length) * 42f);
    }

    private void ApplyPanelLayout(int width)
    {
        float paletteWidth = width < 1600 ? 240f : 280f;
        float infoWidth = width < 1600 ? 300f : 340f;
        RectTransform palette = FindComponent<RectTransform>("ShipBuilderPalettePanel");
        RectTransform info = FindComponent<RectTransform>("ShipBuilderInfoPanel");
        if (palette != null) palette.sizeDelta = new Vector2(paletteWidth, -80f);
        if (info != null) info.sizeDelta = new Vector2(infoWidth, -80f);
    }

    private T FindComponent<T>(string objectName) where T : Component
    {
        Transform child = FindChild(root != null ? root : (Transform)canvas.transform, objectName);
        return child != null ? child.GetComponent<T>() : null;
    }

    private static Transform FindChild(Transform parent, string objectName)
    {
        if (parent == null)
        {
            return null;
        }

        Transform[] children = parent.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < children.Length; i++)
        {
            if (children[i] != null && children[i].name == objectName)
            {
                return children[i];
            }
        }

        return null;
    }

    private static RectTransform CreatePanel(string name, Transform parent, RectPreset preset)
    {
        RectTransform rect = CreateRect(name, parent, preset);
        Image image = rect.gameObject.AddComponent<Image>();
        image.color = PrototypeUiStyle.PanelBackground;
        return rect;
    }

    private static Button CreateButton(string name, Transform parent, string label, RectPreset preset)
    {
        RectTransform rect = CreatePanel(name, parent, preset);
        Button button = rect.gameObject.AddComponent<Button>();
        ColorBlock colors = button.colors;
        colors.normalColor = PrototypeUiStyle.PanelBackground;
        colors.highlightedColor = new Color(0.14f, 0.22f, 0.28f, 0.98f);
        colors.pressedColor = new Color(0.08f, 0.14f, 0.18f, 1f);
        colors.selectedColor = colors.highlightedColor;
        colors.disabledColor = new Color(0.08f, 0.09f, 0.11f, 0.55f);
        button.colors = colors;
        CreateText(name + "Text", rect, label, PrototypeUiStyle.CaptionFontSize, TextAnchor.MiddleCenter, PrototypeUiStyle.TextPrimary, StretchFull(2f, 1f));
        return button;
    }

    private static TMP_InputField CreateInput(string name, Transform parent, RectPreset preset)
    {
        RectTransform rect = CreatePanel(name, parent, preset);
        TMP_InputField input = rect.gameObject.AddComponent<TMP_InputField>();
        TMP_Text text = CreateText(name + "Text", rect, string.Empty, PrototypeUiStyle.BodyFontSize, TextAnchor.MiddleLeft, PrototypeUiStyle.TextPrimary, StretchFull(8f, 2f));
        TMP_Text placeholder = CreateText(name + "Placeholder", rect, "Blueprint", PrototypeUiStyle.BodyFontSize, TextAnchor.MiddleLeft, PrototypeUiStyle.TextSecondary, StretchFull(8f, 2f));
        input.textComponent = text;
        input.placeholder = placeholder;
        return input;
    }

    private static TMP_Text CreateText(string name, Transform parent, string value, int fontSize, TextAnchor alignment, Color color, RectPreset preset)
    {
        TMP_Text text = CreateGraphic<TextMeshProUGUI>(name, parent, preset);
        text.text = value ?? string.Empty;
        text.fontSize = Mathf.Max(PrototypeUiStyle.MinimumReadableFontSize, fontSize);
        text.fontSizeMin = PrototypeUiStyle.MinimumReadableFontSize;
        text.fontSizeMax = Mathf.Max(PrototypeUiStyle.MinimumReadableFontSize, fontSize);
        text.enableAutoSizing = true;
        text.alignment = ToTextAlignmentOptions(alignment);
        text.color = color;
        text.textWrappingMode = TextWrappingModes.Normal;
        text.overflowMode = TextOverflowModes.Truncate;
        text.raycastTarget = false;
        return text;
    }

    private static RectTransform CreateScrollContent(string name, Transform parent, RectPreset preset)
    {
        RectTransform viewport = CreatePanel(name + "Viewport", parent, preset);
        viewport.gameObject.AddComponent<RectMask2D>();
        ScrollRect scroll = viewport.gameObject.AddComponent<ScrollRect>();
        RectTransform content = CreateRect(name, viewport, new RectPreset(new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f), new Vector2(0f, 1f), Vector2.zero));
        scroll.content = content;
        scroll.viewport = viewport;
        scroll.horizontal = false;
        return content;
    }

    private static T CreateGraphic<T>(string name, Transform parent, RectPreset preset) where T : Graphic
    {
        RectTransform rect = CreateRect(name, parent, preset);
        return rect.gameObject.AddComponent<T>();
    }

    private static RectTransform CreateRect(string name, Transform parent, RectPreset preset)
    {
        var gameObject = new GameObject(name, typeof(RectTransform));
        gameObject.transform.SetParent(parent, false);
        var rect = (RectTransform)gameObject.transform;
        rect.anchorMin = preset.AnchorMin;
        rect.anchorMax = preset.AnchorMax;
        rect.pivot = preset.Pivot;
        rect.sizeDelta = preset.SizeDelta;
        rect.anchoredPosition = preset.AnchoredPosition;
        return rect;
    }

    private static RectPreset StretchFull(float insetX = 0f, float insetY = 0f)
    {
        return new RectPreset(Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), new Vector2(-insetX * 2f, -insetY * 2f), Vector2.zero);
    }

    private static void ClearChildren(RectTransform parent)
    {
        if (parent == null)
        {
            return;
        }

        for (int i = parent.childCount - 1; i >= 0; i--)
        {
            DestroyImmediate(parent.GetChild(i).gameObject);
        }
    }

    private static void SetContentHeight(RectTransform content, float height)
    {
        if (content != null)
        {
            content.sizeDelta = new Vector2(content.sizeDelta.x, height);
        }
    }

    private static void SetTextIfChanged(TMP_Text text, string value)
    {
        if (text != null && text.text != (value ?? string.Empty))
        {
            text.text = value ?? string.Empty;
        }
    }

    private static void SetButtonText(Button button, string value)
    {
        TMP_Text text = button != null ? button.GetComponentInChildren<TMP_Text>(true) : null;
        SetTextIfChanged(text, value);
    }

    private static void SetActive(Component component, bool active)
    {
        if (component != null && component.gameObject.activeSelf != active)
        {
            component.gameObject.SetActive(active);
        }
    }

    private static TextAlignmentOptions ToTextAlignmentOptions(TextAnchor anchor)
    {
        switch (anchor)
        {
            case TextAnchor.UpperLeft: return TextAlignmentOptions.TopLeft;
            case TextAnchor.UpperCenter: return TextAlignmentOptions.Top;
            case TextAnchor.UpperRight: return TextAlignmentOptions.TopRight;
            case TextAnchor.MiddleLeft: return TextAlignmentOptions.MidlineLeft;
            case TextAnchor.MiddleCenter: return TextAlignmentOptions.Center;
            case TextAnchor.MiddleRight: return TextAlignmentOptions.MidlineRight;
            case TextAnchor.LowerLeft: return TextAlignmentOptions.BottomLeft;
            case TextAnchor.LowerCenter: return TextAlignmentOptions.Bottom;
            case TextAnchor.LowerRight: return TextAlignmentOptions.BottomRight;
            default: return TextAlignmentOptions.TopLeft;
        }
    }

    private static void EnsureEventSystem()
    {
        if (FindAnyObjectByType<EventSystem>() == null)
        {
            var eventSystem = new GameObject("EventSystem");
            eventSystem.AddComponent<EventSystem>();
            eventSystem.AddComponent<StandaloneInputModule>();
        }
    }
}
