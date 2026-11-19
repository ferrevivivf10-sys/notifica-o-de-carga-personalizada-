import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { createAudioPlayer } from 'expo-audio';

type Kind = 'connect' | 'disconnect';
type Sound = { uri: string; name: string };
type Sounds = Partial<Record<Kind, Sound>>;

const STORAGE_KEY = 'charger-sounds:v1';

const TITLES: Record<Kind, string> = {
  connect: 'Ao conectar o carregador',
  disconnect: 'Ao desconectar o carregador',
};

export default function App() {
  const [sounds, setSounds] = useState<Sounds>({});
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  // Carrega os sons salvos
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) setSounds(JSON.parse(value));
      })
      .catch(() => {});
    return () => playerRef.current?.remove();
  }, []);

  async function save(next: Sounds) {
    setSounds(next);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Charger Sounds</Text>

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
