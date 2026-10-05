import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach auth token to every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('gp_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Handle 401 globally
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('gp_token');
      localStorage.removeItem('gp_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
