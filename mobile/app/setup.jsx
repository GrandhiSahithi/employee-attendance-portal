/**
 * Setup Route
 * ===========
 * Legacy/alias route ("/setup") that simply redirects to the Sign Up
 * screen, so old links or bookmarks still land somewhere valid.
 */

import { Redirect } from 'expo-router';

export default function SetupScreen() {
  return <Redirect href="/signup" />;
}
