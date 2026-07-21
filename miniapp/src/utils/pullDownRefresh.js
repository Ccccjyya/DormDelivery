const MAX_REFRESH_MS = 5000;

export async function runPullDownRefresh(task, stop = () => uni.stopPullDownRefresh()) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(resolve, MAX_REFRESH_MS);
  });
  try {
    await Promise.race([Promise.resolve().then(task), timeout]);
  } finally {
    clearTimeout(timeoutId);
    stop();
  }
}
