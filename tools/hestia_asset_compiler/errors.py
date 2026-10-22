class CompilerError(ValueError):
    """Stable machine-readable rejection, without source paths or host state."""

    def __init__(self, code, message):
        self.code = code
        super().__init__(f"{code}: {message}")
