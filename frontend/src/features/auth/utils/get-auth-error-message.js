const authErrorMessages = {
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "The email or password is incorrect.",
  "auth/wrong-password": "The email or password is incorrect.",
  "auth/network-request-failed":
    "We could not connect to the authentication service. Try again.",
  "auth/email-already-in-use": "An account already exists for this email.",
  "auth/weak-password": "Your password must be at least six characters.",
};

function getAuthErrorMessage(
  error,
  fallback = "We could not complete this request. Try again.",
) {
  return authErrorMessages[error?.code] ?? fallback;
}

export { getAuthErrorMessage };
