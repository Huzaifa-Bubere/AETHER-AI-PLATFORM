import axios from 'axios';
import { apiBaseURL, attachAuthentication } from '../app/services/http';

// Aptitude paths already contain /api and return raw response payloads.
export default attachAuthentication(axios.create({
  baseURL: apiBaseURL.replace(/\/api$/, ''),
  timeout: 60000,
}));
