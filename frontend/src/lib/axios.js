import axios from "axios";

const BASE_URL = import.meta.env.MODE === "development"
  ? `http://${window.location.hostname}:5001/api`
  : (import.meta.env.VITE_API_BASE_URL || "/api");

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send cookies with the request (works in dev)
});

// Attach Bearer token for production cross-origin requests
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Helper to save token after login/signup
export const saveToken = (token) => {
  if (token) localStorage.setItem("jwt_token", token);
};

// Helper to clear token on logout
export const clearToken = () => {
  localStorage.removeItem("jwt_token");
};
