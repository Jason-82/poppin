export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-5xl font-bold text-white">P</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-4 text-white">
          You&apos;re Offline
        </h1>

        <p className="text-gray-400 mb-6">
          It looks like you&apos;ve lost your internet connection. Some features may not be available until you&apos;re back online.
        </p>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-300">
            Cached venue data may still be available. Try refreshing when you&apos;re back online to see the latest crowd levels.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
