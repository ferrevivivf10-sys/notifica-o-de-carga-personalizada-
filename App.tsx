import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { createAudioPlayer } from 'expo-audio';
import ChargerService from './modules/charger-service';

type Kind = 'connect' | 'disconnect';
type Sound = { uri: string; name: string };
type Sounds = Partial<Record<Kind, Sound>>;

const STORAGE_KEY = 'charger-sounds:v1';

const TITLES: Record<Kind, string> = {
  connect: 'Ao conectar o carregador',
  disconnect: 'Ao desconectar o carregador',
};

// Envia os caminhos dos áudios para o serviço nativo
function syncNative(sounds: Sounds) {
  ChargerService.setSounds(sounds.connect?.uri ?? null, sounds.disconnect?.uri ?? null);
}

export default function App() {
  const [sounds, setSounds] = useState<Sounds>({});
  const [enabled, setEnabled] = useState(false);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  // Carrega os sons salvos e o estado do serviço
  useEffect(() => {
    setEnabled(ChargerService.isRunning());
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const saved: Sounds = JSON.parse(value);
        setSounds(saved);
        syncNative(saved);
      })
      .catch(() => {});
    return () => playerRef.current?.remove();
  }, []);

  async function save(next: Sounds) {
    setSounds(next);
    syncNative(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function pick(kind: Kind) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const safeName = asset.name.replace(/[^\w.-]/g, '_');
      const destination = new File(Paths.document, `${kind}_${safeName}`);
      await new File(asset.uri).copy(destination, { overwrite: true });

      // Apaga o arquivo anterior, se for outro
      const old = sounds[kind];
      if (old && old.uri !== destination.uri) {
        try {
          new File(old.uri).delete();
        } catch {}
      }

      await save({ ...sounds, [kind]: { uri: destination.uri, name: asset.name } });
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o áudio.');
    }
  }

  function test(kind: Kind) {
    const sound = sounds[kind];
    if (!sound) return;
    playerRef.current?.remove();
    const player = createAudioPlayer({ uri: sound.uri });
    playerRef.current = player;
    player.play();
  }

  async function toggle(value: boolean) {
    if (!value) {
      ChargerService.stop();
      setEnabled(false);
      return;
    }

    if (!sounds.connect && !sounds.disconnect) {
      Alert.alert('Escolha um som', 'Escolha pelo menos um som antes de ativar.');
      return;
    }

    // Android 13+ pede permissão para mostrar a notificação do serviço
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    ChargerService.start();
    setEnabled(true);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Charger Sounds</Text>

      <View style={[styles.card, styles.switchRow]}>
        <View style={styles.switchText}>
          <Text style={styles.cardTitle}>Monitorar em segundo plano</Text>
          <Text style={styles.fileName}>Mostra uma notificação fixa enquanto estiver ativo</Text>
        </View>
        <Switch value={enabled} onValueChange={toggle} />
      </View>

      {(['connect', 'disconnect'] as Kind[]).map((kind) => (
        <View key={kind} style={styles.card}>
          <Text style={styles.cardTitle}>{TITLES[kind]}</Text>
          <Text style={styles.fileName} numberOfLines={1}>
            {sounds[kind]?.name ?? 'Nenhum som escolhido'}
          </Text>
          <View style={styles.row}>
            <Pressable style={styles.button} onPress={() => pick(kind)}>
              <Text style={styles.buttonText}>Escolher</Text>
            </Pressable>
            <Pressable
              style={[styles.button, !sounds[kind] && styles.disabled]}
              disabled={!sounds[kind]}
              onPress={() => test(kind)}
            >
              <Text style={styles.buttonText}>Testar</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#F2F4F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchText: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  fileName: {
    color: '#555',
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    backgroundColor: '#1D6FEB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.4,
  },
});
