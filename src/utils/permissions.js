const DEV_USER_ID = '888743210363551755';
const STAFF_ROLE_ID = '1489698084161060934';
const AUTO_ROLE_ID = '1499175374142308533';
const CUSTOMER_ROLE_ID = '1499202163740512296';

function hasPermission(member) {
  if (!member) return false;
  if (member.id === DEV_USER_ID) return true;
  return member.roles.cache.has(STAFF_ROLE_ID);
}

function isDev(userId) {
  return userId === DEV_USER_ID;
}

module.exports = { hasPermission, isDev, DEV_USER_ID, STAFF_ROLE_ID, AUTO_ROLE_ID, CUSTOMER_ROLE_ID };
