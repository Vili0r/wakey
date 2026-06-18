import SFIcon from '@/components/SF-icon';
import { THEMES } from '@/constants/theme';
import { Asset } from 'expo-asset';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { models, usePoseEstimation } from 'react-native-executorch';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DevExecutorchScreen() {
  const theme = THEMES.dark; // Premium dark diagnostics theme
  const [inferenceResult, setInferenceResult] = useState<string>('');
  const [loadingAsset, setLoadingAsset] = useState<boolean>(false);
  const [keypointCount, setKeypointCount] = useState<number>(0);

  // Initialize YOLO26N-Pose model hook
  let modelHook: any = null;
  let hookError: any = null;

  try {
    modelHook = usePoseEstimation({ model: models.pose_estimation.yolo26n() });
  } catch (e: any) {
    hookError = e;
  }

  const isReady = modelHook?.isReady ?? false;
  const downloadProgress = modelHook?.downloadProgress ?? 0;
  const isGenerating = modelHook?.isGenerating ?? false;
  const modelError = modelHook?.error || hookError;

  const runTestInference = async () => {
    if (!modelHook) {
      setInferenceResult('Error: Pose estimation hook is not initialized.');
      return;
    }

    try {
      setLoadingAsset(true);
      setInferenceResult('Loading test image asset...');
      
      // Load the react-logo.png asset
      const asset = Asset.fromModule(require('../../assets/images/react-logo.png'));
      await asset.downloadAsync();
      const localUri = asset.localUri || asset.uri;

      if (!localUri) {
        throw new Error('Failed to resolve local URI for test image.');
      }

      setInferenceResult(`Running inference on: ${localUri}\nThis might take a moment on first run...`);
      
      // Run inference via the hook's forward method
      const start = Date.now();
      const results = await modelHook.forward(localUri, {
        detectionThreshold: 0.5,
        keypointThreshold: 0.5,
      });
      const end = Date.now();

      setLoadingAsset(false);
      
      if (results && results.length > 0) {
        const firstPerson = results[0];
        // Calculate non-filtered keypoints (not -1, -1)
        const validKeypoints = Object.entries(firstPerson).filter(
          ([_, kp]: [string, any]) => kp && kp.x !== -1 && kp.y !== -1
        );
        
        setKeypointCount(validKeypoints.length);
        setInferenceResult(
          `Success! Inference took ${end - start}ms\n\n` +
          `Detected ${results.length} person(s).\n` +
          `Valid keypoints for Person 1: ${validKeypoints.length}/17\n\n` +
          `Keypoint Details:\n` +
          validKeypoints.map(([name, kp]: [string, any]) => `• ${name}: (${kp.x.toFixed(1)}, ${kp.y.toFixed(1)})`).join('\n')
        );
      } else {
        setKeypointCount(0);
        setInferenceResult(`Inference completed in ${end - start}ms, but no people were detected in the image.`);
      }
    } catch (e: any) {
      setLoadingAsset(false);
      setInferenceResult(`Error running inference:\n${e.message || e}`);
      console.error('Inference error:', e);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <SFIcon name="cpu" size={28} color={theme.accent} />
          <Text style={[styles.title, { color: theme.text }]}>ExecuTorch Diagnostics</Text>
        </View>

        {/* Model Status Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.textDim }]}>YOLO26N-Pose Model Status</Text>
          
          <View style={styles.statusRow}>
            <Text style={{ color: theme.textFaint }}>Is Ready:</Text>
            <View style={[styles.badge, { backgroundColor: isReady ? '#1E3A1E' : '#3D1E1E' }]}>
              <Text style={[styles.badgeText, { color: isReady ? '#4ADE80' : '#F87171' }]}>
                {isReady ? 'READY' : 'NOT READY'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={{ color: theme.textFaint }}>Download Progress:</Text>
            <Text style={{ color: theme.text, fontFamily: 'SpaceMono_400Regular' }}>
              {(downloadProgress * 100).toFixed(1)}%
            </Text>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressBarBg, { backgroundColor: theme.surfaceBorder }]}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${Math.min(Math.max(downloadProgress * 100, 0), 100)}%`, 
                  backgroundColor: theme.accent 
                }
              ]} 
            />
          </View>

          {modelError && (
            <View style={styles.errorContainer}>
              <SFIcon name="exclamationmark.triangle" size={16} color="#F87171" />
              <Text style={styles.errorText}>
                {modelError.message || String(modelError)}
              </Text>
            </View>
          )}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={runTestInference}
          disabled={!isReady || isGenerating || loadingAsset}
          style={[
            styles.button,
            { 
              backgroundColor: isReady && !isGenerating && !loadingAsset ? theme.accent : '#2C2C2E',
              opacity: isReady && !isGenerating && !loadingAsset ? 1 : 0.6
            }
          ]}
          activeOpacity={0.8}
        >
          {isGenerating || loadingAsset ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <SFIcon name="play.fill" size={16} color="white" />
              <Text style={styles.buttonText}>Run Test Inference</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Results Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
          <Text style={[styles.cardTitle, { color: theme.textDim }]}>Inference Results</Text>
          <ScrollView style={styles.resultBox} nestedScrollEnabled>
            <Text style={[styles.resultText, { color: theme.text }]}>
              {inferenceResult || 'Waiting for test run...'}
            </Text>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  title: {
    fontFamily: 'InstrumentSerif_400Regular_Italic',
    fontSize: 28,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3A1E1E',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    flex: 1,
  },
  button: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: 'white',
    fontFamily: 'Sora_700Bold',
    fontSize: 15,
  },
  resultBox: {
    maxHeight: 300,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 12,
  },
  resultText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
});
