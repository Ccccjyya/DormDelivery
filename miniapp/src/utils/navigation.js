let relaunching = false;

function normalizedRoute(url) {
  return String(url || '').replace(/^\//, '').split('?')[0];
}

export function currentPageRoute() {
  const pages = getCurrentPages();
  return pages[pages.length - 1]?.route || '';
}

export function safeReLaunch(url, delay = 30) {
  const targetRoute = normalizedRoute(url);
  if (!targetRoute || currentPageRoute() === targetRoute || relaunching) {
    return Promise.resolve(false);
  }

  relaunching = true;
  return new Promise((resolve) => {
    setTimeout(() => {
      uni.reLaunch({
        url: url.startsWith('/') ? url : `/${url}`,
        success: () => resolve(true),
        fail: (error) => {
          console.error('page relaunch failed', {
            targetRoute,
            message: error?.errMsg || error?.message || 'reLaunch failed'
          });
          resolve(false);
        },
        complete: () => {
          setTimeout(() => { relaunching = false; }, 300);
        }
      });
    }, delay);
  });
}
