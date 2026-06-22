// super-admin-dashboard/src/services/apiClient.js
// FIXED: Was broken re-export pointing to non-existent '../apiClient'.
// Now correctly re-exports from the canonical lib/apiClient.js.
// This file exists ONLY for backwards-compat with pages that import from services/.
// All new code should import directly from '../lib/apiClient'.

import { api as _api } from '../lib/apiClient';

// Wrap in an axios-compatible shape so existing pages work without changes
const apiClient = {
  get:    (url, config)       => _api.get(url, config),
  post:   (url, data, config) => _api.post(url, data, config).then(r => ({ data: r })),
  put:    (url, data, config) => _api.put(url, data, config).then(r => ({ data: r })),
  patch:  (url, data, config) => _api.patch(url, data, config).then(r => ({ data: r })),
  delete: (url, config)       => _api.delete(url, config).then(r => ({ data: r })),
};

// Override get to also wrap in { data: ... } shape expected by pages using apiClient.get().then(r => r.data)
apiClient.get = (url, config) => _api.get(url, config).then(r => ({ data: r }));

export default apiClient;
