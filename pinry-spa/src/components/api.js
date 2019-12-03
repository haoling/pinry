import axios from 'axios';
import storage from './utils/storage';

const API_PREFIX = '/api/v2/';

function fetchPins(offset, tagFilter, userFilter) {
  const url = `${API_PREFIX}pins/`;
  const queryArgs = {
    format: 'json',
    ordering: '-id',
    limit: 30,
    offset,
  };
  if (tagFilter) queryArgs.tags__name = tagFilter;
  if (userFilter) queryArgs.submitter__username = userFilter;
  return axios.get(
    url,
    { params: queryArgs },
  );
}

function fetchPin(pinId) {
  const url = `${API_PREFIX}pins/${pinId}`;
  return new Promise(
    (resolve, reject) => {
      const p = axios.get(
        url,
      );
      p.then(
        (resp) => {
          const response = {
            data: { results: [resp.data], next: null },
          };
          resolve(response);
        },
        (error) => {
          reject(error);
        },
      );
    },
  );
}

function fetchPinsForBoard(boardId) {
  const url = `${API_PREFIX}boards/${boardId}`;
  return new Promise(
    (resolve, reject) => {
      axios.get(url).then(
        (resp) => {
          resolve({ data: { results: resp.data.pins_detail, next: null } });
        },
        error => reject(error),
      );
    },
  );
}

function fetchBoardForUser(username) {
  const url = `${API_PREFIX}boards/?submitter__username=${username}`;
  return axios.get(url);
}

const User = {
  storageKey: 'pinry.user',
  signUp(username, email, password, passwordRepeat) {
    const url = `${API_PREFIX}profile/users/`;
    return new Promise(
      (resolve, reject) => {
        const p = axios.post(
          url,
          {
            username,
            email,
            password,
            password_repeat: passwordRepeat,
          },
        );
        p.then(
          (resp) => {
            if (resp.status !== 201) {
              reject(resp);
            }
            resolve(resp.data);
          },
          (error) => {
            console.log('Failed to sign up due to unexpected error:', error);
            reject(error.response);
          },
        );
      },
    );
  },
  logIn(username, password) {
    const url = `${API_PREFIX}profile/login/`;
    return new Promise(
      (resolve, reject) => {
        const p = axios.post(
          url,
          {
            username,
            password,
          },
        );
        p.then(
          (resp) => {
            if (resp.status !== 200) {
              reject(resp);
            }
            resolve(resp.data);
          },
          (error) => {
            console.log('Failed to log in due to unexpected error:', error);
            reject(error.response);
          },
        );
      },
    );
  },
  logOut() {
    const self = this;
    return new Promise(
      (resolve) => {
        axios.get('/api-auth/logout/').then(
          () => {
            storage.set(self.storageKey, null, 1);
            resolve();
          },
        );
      },
    );
  },
  fetchUserInfo(force = false) {
    /* returns null if user not logged in */
    const self = this;
    if (!force) {
      const userInfo = storage.get(self.storageKey);
      if (userInfo !== null) {
        return new Promise(
          resolve => resolve(userInfo),
        );
      }
    }
    const url = `${API_PREFIX}/profile/users/`;
    return new Promise(
      (resolve) => {
        axios.get(url).then(
          (resp) => {
            const users = resp.data;
            if (users.length === 0) {
              return resolve(null);
            }
            const value = users[0];
            storage.set(self.storageKey, value, 60 * 5 * 1000);
            return resolve(users[0]);
          },
        );
      },
    );
  },
};

export default {
  fetchPin,
  fetchPins,
  fetchPinsForBoard,
  fetchBoardForUser,
  User,
};
