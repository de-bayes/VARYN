library(dplyr)
library(tidyr)
library(ggplot2)
library(broom)
library(base64enc)

# ── Command dispatcher ─────────────────────────────────
execute_command <- function(command, df) {
  cmd  <- trimws(command)
  verb <- tolower(strsplit(cmd, "\\s+")[[1]][1])

  switch(verb,
    "describe"  = cmd_describe(cmd, df),
    "summarize" = cmd_summarize(cmd, df),
    "sum"       = cmd_summarize(cmd, df),
    "tab"       = cmd_tab(cmd, df),
    "gen"       = cmd_gen(cmd, df),
    "replace"   = cmd_replace(cmd, df),
    "keep"      = cmd_keep(cmd, df),
    "drop"      = cmd_drop(cmd, df),
    "reg"       = cmd_reg(cmd, df),
    "scatter"   = cmd_scatter(cmd, df),
    stop(paste0("Unknown command: ", verb))
  )
}

# ── describe ───────────────────────────────────────────
cmd_describe <- function(cmd, df) {
  if (is.null(df)) stop("No dataset loaded")
  info <- data.frame(
    Variable = names(df),
    Type     = sapply(df, function(x) class(x)[1]),
    N        = sapply(df, function(x) sum(!is.na(x))),
    Missing  = sapply(df, function(x) sum(is.na(x))),
    stringsAsFactors = FALSE
  )
  make_table_result("Dataset Description", info)
}

# ── summarize [varlist] ────────────────────────────────
cmd_summarize <- function(cmd, df) {
  if (is.null(df)) stop("No dataset loaded")
  tokens <- strsplit(trimws(cmd), "\\s+")[[1]][-1]  # drop verb

  if (length(tokens) == 0) {
    vars <- names(df)[sapply(df, is.numeric)]
  } else {
    vars <- tokens
  }

  rows <- lapply(vars, function(v) {
    x <- df[[v]]
    if (is.null(x)) stop(paste("Variable not found:", v))
    data.frame(
      Variable = v,
      N        = sum(!is.na(x)),
      Mean     = round(mean(x, na.rm = TRUE), 4),
      SD       = round(sd(x, na.rm = TRUE), 4),
      Min      = round(min(x, na.rm = TRUE), 4),
      Max      = round(max(x, na.rm = TRUE), 4),
      stringsAsFactors = FALSE
    )
  })
  out <- do.call(rbind, rows)
  make_table_result("Summary Statistics", out)
}

# ── tab var [var2] ─────────────────────────────────────
cmd_tab <- function(cmd, df) {
  if (is.null(df)) stop("No dataset loaded")
  tokens <- strsplit(trimws(cmd), "\\s+")[[1]][-1]
  if (length(tokens) == 0) stop("tab requires at least one variable")

  if (length(tokens) == 1) {
    tbl <- as.data.frame(table(df[[tokens[1]]], dnn = tokens[1]))
    names(tbl) <- c(tokens[1], "Freq")
  } else {
    tbl <- as.data.frame(table(df[[tokens[1]]], df[[tokens[2]]], dnn = tokens[1:2]))
    names(tbl) <- c(tokens[1], tokens[2], "Freq")
  }
  make_table_result(paste("Tabulation:", paste(tokens, collapse = " x ")), tbl)
}

# ── gen newvar = expression ────────────────────────────
cmd_gen <- function(cmd, df) {
  if (is.null(df)) stop("No dataset loaded")
  # Parse: gen newvar = expr
  m <- regmatches(cmd, regexec("^gen\\s+(\\w+)\\s*=\\s*(.+)$", cmd, ignore.case = TRUE))[[1]]
  if (length(m) < 3) stop("Syntax: gen newvar = expression")
  varname <- m[2]
  expr_str <- m[3]
  df[[varname]] <- eval(parse(text = expr_str), envir = df)
  list(
    status = "success",
    tables = list(list(
      title = paste("Generated:", varname),
      columns = c("Variable", "N", "Mean"),
      rows = list(list(Variable = varname, N = sum(!is.na(df[[varname]])), Mean = round(mean(df[[varname]], na.rm = TRUE), 4)))
    )),
    plots = list(),
    logs = paste("Variable", varname, "created")
  )
}

# ── replace var = expression [if condition] ────────────
cmd_replace <- function(cmd, df) {
  if (is.null(df)) stop("No dataset loaded")
  m <- regmatches(cmd, regexec("^replace\\s+(\\w+)\\s*=\\s*(.+?)(?:\\s+if\\s+(.+))?$", cmd, ignore.case = TRUE))[[1]]
  if (length(m) < 3) stop("Syntax: replace var = expression [if condition]")
  varname  <- m[2]
  expr_str <- m[3]
  cond_str <- if (length(m) >= 4 && nzchar(m[4])) m[4] else NULL

  if (!is.null(cond_str)) {
    mask <- eval(parse(text = cond_str), envir = df)
    df[[varname]][mask] <- eval(parse(text = expr_str), envir = df)[mask]
  } else {
    df[[varname]] <- eval(parse(text = expr_str), envir = df)
  }

  list(
    status = "success",
    tables = list(),
    plots  = list(),
    logs   = paste("Variable", varname, "replaced")
  )
}

# ── keep/drop ──────────────────────────────────────────
cmd_keep <- function(cmd, df) {
  if (is.null(df)) stop("No dataset loaded")
  tokens <- strsplit(trimws(cmd), "\\s+")[[1]][-1]
  if (length(tokens) == 0) stop("keep requires variable names")
  list(
    status = "success",
    tables = list(),
    plots  = list(),
    logs   = paste("Kept variables:", paste(tokens, collapse = ", "))
  )
}

cmd_drop <- function(cmd, df) {
  if (is.null(df)) stop("No dataset loaded")
  tokens <- strsplit(trimws(cmd), "\\s+")[[1]][-1]
  if (length(tokens) == 0) stop("drop requires variable names")
  list(
    status = "success",
    tables = list(),
    plots  = list(),
    logs   = paste("Dropped variables:", paste(tokens, collapse = ", "))
  )
}

# ── reg y x1 x2..., [robust] [cluster(var)] ───────────
cmd_reg <- function(cmd, df) {
  if (is.null(df)) stop("No dataset loaded")
  # Split on comma for options
  parts <- strsplit(cmd, ",")[[1]]
  vars_part <- trimws(parts[1])
  opts_part <- if (length(parts) > 1) tolower(trimws(parts[2])) else ""

  tokens <- strsplit(vars_part, "\\s+")[[1]][-1]  # drop 'reg'
  if (length(tokens) < 2) stop("reg requires: reg y x1 [x2 ...]")

  y_var <- tokens[1]
  x_vars <- tokens[-1]
  formula_str <- paste(y_var, "~", paste(x_vars, collapse = " + "))
  formula_obj <- as.formula(formula_str)

  # Check for robust / cluster
  use_robust <- grepl("robust", opts_part)
  cluster_match <- regmatches(opts_part, regexec("cluster\\((\\w+)\\)", opts_part))[[1]]
  cluster_var <- if (length(cluster_match) >= 2) cluster_match[2] else NULL

  if (!is.null(cluster_var)) {
    model <- estimatr::lm_robust(formula_obj, data = df, clusters = df[[cluster_var]], se_type = "CR2")
  } else if (use_robust) {
    model <- estimatr::lm_robust(formula_obj, data = df, se_type = "HC2")
  } else {
    model <- lm(formula_obj, data = df)
  }

  tidy_out <- broom::tidy(model)
  tidy_out <- tidy_out[, c("term", "estimate", "std.error", "statistic", "p.value")]
  names(tidy_out) <- c("Term", "Estimate", "Std. Error", "t value", "p value")
  tidy_out$Estimate     <- round(tidy_out$Estimate, 4)
  tidy_out$`Std. Error` <- round(tidy_out$`Std. Error`, 4)
  tidy_out$`t value`    <- round(tidy_out$`t value`, 3)
  tidy_out$`p value`    <- round(tidy_out$`p value`, 4)

  title <- paste0("OLS: ", formula_str)
  if (use_robust) title <- paste0(title, " (robust)")
  if (!is.null(cluster_var)) title <- paste0(title, " (cluster: ", cluster_var, ")")

  make_table_result(title, tidy_out)
}

# ── scatter y x, [lfit] ───────────────────────────────
cmd_scatter <- function(cmd, df) {
  if (is.null(df)) stop("No dataset loaded")
  parts <- strsplit(cmd, ",")[[1]]
  vars_part <- trimws(parts[1])
  opts_part <- if (length(parts) > 1) tolower(trimws(parts[2])) else ""

  tokens <- strsplit(vars_part, "\\s+")[[1]][-1]
  if (length(tokens) < 2) stop("scatter requires: scatter y x")

  y_var <- tokens[1]
  x_var <- tokens[2]
  add_lfit <- grepl("lfit", opts_part)

  p <- ggplot(df, aes(x = .data[[x_var]], y = .data[[y_var]])) +
    geom_point(alpha = 0.5, color = "#f0f0eb", size = 1.5) +
    theme_minimal(base_size = 12) +
    theme(
      plot.background  = element_rect(fill = "#0d0d0f", color = NA),
      panel.background = element_rect(fill = "#151518", color = NA),
      panel.grid       = element_line(color = "rgba(255,255,255,0.05)"),
      text             = element_text(color = "#f5f5f2"),
      axis.text        = element_text(color = "#b8b8b1")
    )

  if (add_lfit) {
    p <- p + geom_smooth(method = "lm", se = FALSE, color = "#f0f0eb", linewidth = 0.7)
  }

  # Render to PNG, encode base64
  tmp <- tempfile(fileext = ".png")
  ggsave(tmp, p, width = 7, height = 5, dpi = 150, bg = "#0d0d0f")
  png_b64 <- base64encode(tmp)
  unlink(tmp)

  list(
    status = "success",
    tables = list(),
    plots  = list(list(
      title     = paste("Scatter:", y_var, "vs", x_var),
      pngBase64 = png_b64
    )),
    logs = ""
  )
}

# ── Helpers ────────────────────────────────────────────
make_table_result <- function(title, df) {
  rows <- lapply(seq_len(nrow(df)), function(i) as.list(df[i, , drop = FALSE]))
  list(
    status = "success",
    tables = list(list(
      title   = title,
      columns = names(df),
      rows    = rows
    )),
    plots = list(),
    logs  = ""
  )
}
