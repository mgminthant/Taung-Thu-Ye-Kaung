import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import agricultureQa from './src/data/agricultureQa.json';
import type { AgricultureQaRecord } from './src/data/types';

const records = agricultureQa as AgricultureQaRecord[];

export default function App() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((item) => {
      const haystack = [
        item.crop,
        item.topic,
        item.question,
        item.answer,
        ...item.symptoms,
        ...item.possible_causes,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  const selected = records.find((item) => item.id === selectedId) ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>တောင်သူ့ရဲ့ခေါင်</Text>
        <Text style={styles.subtitle}>
          Knowledge base preview · {records.length} English Q&A entries
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search crop, symptom, or question..."
          placeholderTextColor="#6b7c6e"
          style={styles.search}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {selected ? (
        <View style={styles.detail}>
          <Pressable onPress={() => setSelectedId(null)} style={styles.backButton}>
            <Text style={styles.backText}>← Back to list</Text>
          </Pressable>
          <Text style={styles.meta}>
            {selected.crop} · {selected.topic}
            {selected.verified ? ' · verified' : ''}
          </Text>
          <Text style={styles.question}>{selected.question}</Text>
          <Text style={styles.answer}>{selected.answer}</Text>
          <Text style={styles.sectionLabel}>Symptoms</Text>
          <Text style={styles.body}>{selected.symptoms.join(', ') || '—'}</Text>
          <Text style={styles.sectionLabel}>Possible causes</Text>
          <Text style={styles.body}>
            {selected.possible_causes.join(', ') || '—'}
          </Text>
          <Text style={styles.sectionLabel}>Solution</Text>
          <Text style={styles.body}>{selected.solution}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No matching knowledge entries.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => setSelectedId(item.id)}
            >
              <Text style={styles.cardMeta}>
                {item.crop} · {item.topic}
              </Text>
              <Text style={styles.cardQuestion}>{item.question}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#eef5ea',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f3d2a',
  },
  subtitle: {
    fontSize: 14,
    color: '#4d6353',
  },
  search: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c5d6c8',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f3d2a',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#d7e5d9',
  },
  cardMeta: {
    fontSize: 12,
    color: '#5f7a64',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  cardQuestion: {
    fontSize: 16,
    color: '#1f3d2a',
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: '#5f7a64',
    marginTop: 40,
  },
  detail: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: {
    color: '#2f6b45',
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: '#5f7a64',
    textTransform: 'capitalize',
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f3d2a',
    marginBottom: 4,
  },
  answer: {
    fontSize: 16,
    lineHeight: 24,
    color: '#24382c',
    marginBottom: 8,
  },
  sectionLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#2f6b45',
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#314539',
  },
});
