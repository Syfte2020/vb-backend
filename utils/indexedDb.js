export const DB_NAME = "temp-upload-db";
export const STORE_NAME = "uploads";

export const saveBlob = async (key, file) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      const tx = db.transaction(STORE_NAME, "readwrite");

      tx.objectStore(STORE_NAME).put(file, key);

      tx.oncomplete = () => resolve(true);

      tx.onerror = () => reject(tx.error);
    };

    request.onerror = () => reject(request.error);
  });
};
export const getBlob = async (key) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      const tx = db.transaction(STORE_NAME, "readonly");

      const store = tx.objectStore(STORE_NAME);

      const getRequest = store.get(key);

      getRequest.onsuccess = () => {
        resolve(getRequest.result);
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
};

export const deleteBlob = async (key) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onsuccess = () => {
      const db = request.result;

      const tx = db.transaction(STORE_NAME, "readwrite");

      tx.objectStore(STORE_NAME).delete(key);

      tx.oncomplete = () => resolve(true);

      tx.onerror = () => reject(tx.error);
    };

    request.onerror = () => reject(request.error);
  });
};