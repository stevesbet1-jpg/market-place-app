import React from 'react';
import { Redirect } from 'expo-router';

export default function UploadJourneyRedirect() {
  return <Redirect href='/(tabs)/create-journey' />;
}
