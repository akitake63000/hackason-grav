export const firestorePaths = {
  user: (uid: string) => `users/${uid}`,
  profile: (uid: string) => `users/${uid}/profile/default`,
  photo: (uid: string, photoId: string) => `users/${uid}/photos/${photoId}`,
  analysisResult: (uid: string, analysisId: string) =>
    `users/${uid}/analysisResults/${analysisId}`,
  report: (uid: string, reportId: string) => `users/${uid}/reports/${reportId}`,
  conversation: (uid: string, threadId: string) =>
    `users/${uid}/conversations/${threadId}`,
  message: (uid: string, threadId: string, messageId: string) =>
    `users/${uid}/conversations/${threadId}/messages/${messageId}`,
  tendencyScore: (uid: string, scoreId: string) =>
    `users/${uid}/tendencyScores/${scoreId}`,
  foodRecommendation: (uid: string, recommendationId: string) =>
    `users/${uid}/foodRecommendations/${recommendationId}`,
  foodRecipe: (uid: string, recipeId: string) =>
    `users/${uid}/foodRecipes/${recipeId}`,
};

export const storagePaths = {
  photo: (uid: string, photoId: string, ext = "jpg") =>
    `users/${uid}/photos/${photoId}.${ext}`,
};
