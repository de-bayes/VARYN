library(jsonlite)

#* Health check
#* @get /health
function() {
  list(status = "ok")
}

#* Execute a Varyn command
#* @post /execute
#* @serializer unboxedJSON
function(req) {
  body <- fromJSON(req$postBody, simplifyDataFrame = FALSE)

  run_id         <- body$runId
  project_id     <- body$projectId
  command        <- body$command
  dataset_url    <- body$datasetUrl
  dataset_file   <- body$datasetFilename
  timeout_sec    <- body$timeoutSeconds %||% 30

  start_time <- proc.time()["elapsed"]

  result <- tryCatch(
    {
      # Download dataset if provided
      df <- NULL
      if (nzchar(dataset_url)) {
        tmp <- tempfile(fileext = paste0(".", tools::file_ext(dataset_file)))
        download.file(dataset_url, tmp, mode = "wb", quiet = TRUE)
        df <- load_dataset(tmp, dataset_file)
      }

      # Parse and execute the Stata-like command
      execute_command(command, df)
    },
    error = function(e) {
      list(
        status = "error",
        tables = list(),
        plots  = list(),
        logs   = conditionMessage(e)
      )
    }
  )

  elapsed <- round((proc.time()["elapsed"] - start_time) * 1000)

  list(
    status     = result$status %||% "success",
    tables     = result$tables %||% list(),
    plots      = result$plots %||% list(),
    logs       = result$logs %||% "",
    durationMs = as.integer(elapsed)
  )
}

# ── Helpers ────────────────────────────────────────────

`%||%` <- function(a, b) if (is.null(a)) b else a

load_dataset <- function(path, filename) {
  ext <- tolower(tools::file_ext(filename))
  if (ext == "dta") {
    haven::read_dta(path)
  } else {
    readr::read_csv(path, show_col_types = FALSE)
  }
}

source("R/commands.R")
