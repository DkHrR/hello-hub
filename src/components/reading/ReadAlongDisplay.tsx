/**
 * Read-Along Display Component
 * Synchronized TTS with word highlighting for assistive reading
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX,
  SkipBack,
  SkipForward,
  Settings,
  BookOpen
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface ReadAlongDisplayProps {
  text: string;
  title?: string;
  language?: string;
  onWordFocus?: (wordIndex: number, word: string) => void;
  onComplete?: () => void;
  gazeWordIndex?: number; // From eye tracking
  showGazeComparison?: boolean;
}

export function ReadAlongDisplay({
  text,
  title,
  language = 'english',
  onWordFocus,
  onComplete,
  gazeWordIndex,
  showGazeComparison = false,
}: ReadAlongDisplayProps) {
  const [rate, setRate] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const tts = useTextToSpeech({
    rate,
    language: language === 'hindi' ? 'hi-IN' : 
              language === 'tamil' ? 'ta-IN' :
              language === 'telugu' ? 'te-IN' : 'en-US',
  });

  const words = text.split(/\s+/);

  const handlePlay = () => {
    if (tts.isPaused) {
      tts.resume();
    } else if (!tts.isPlaying) {
      tts.speak(text, {
        onWordChange: (index) => {
          onWordFocus?.(index, words[index]);
          // Auto-scroll to keep current word visible
          scrollToWord(index);
        },
        onComplete,
      });
    }
  };

  const scrollToWord = (index: number) => {
    const wordElement = containerRef.current?.querySelector(`[data-word-index="${index}"]`);
    wordElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleVoiceChange = (voiceURI: string) => {
    const voice = tts.voices.find(v => v.voiceURI === voiceURI);
    if (voice) tts.setVoice(voice);
  };

  const handleRateChange = (value: number[]) => {
    setRate(value[0]);
    tts.setRate(value[0]);
  };

  const skipToWord = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next' 
      ? Math.min(tts.currentWordIndex + 1, words.length - 1)
      : Math.max(tts.currentWordIndex - 1, 0);
    
    // Restart from new position (simplified - full implementation would use SSML)
    tts.stop();
    const remainingText = words.slice(newIndex).join(' ');
    tts.speak(remainingText, {
      onWordChange: (relIndex) => {
        const actualIndex = newIndex + relIndex;
        onWordFocus?.(actualIndex, words[actualIndex]);
        scrollToWord(actualIndex);
      },
      onComplete,
    });
  };

  const availableVoices = tts.getVoicesForLanguage(language);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {title || 'Read Along'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {tts.isPlaying && (
              <Badge variant="secondary" className="animate-pulse">
                Reading...
              </Badge>
            )}
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Reading Settings</SheetTitle>
                </SheetHeader>
                <div className="space-y-6 mt-6">
                  {/* Voice Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Voice</label>
                    <Select
                      value={tts.selectedVoice?.voiceURI}
                      onValueChange={handleVoiceChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.map((voice) => (
                          <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                            {voice.name} ({voice.lang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {tts.selectedVoice && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => tts.previewVoice(tts.selectedVoice!)}
                      >
                        Preview Voice
                      </Button>
                    )}
                  </div>

                  {/* Speed Control */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Speed: {rate.toFixed(1)}x
                    </label>
                    <Slider
                      value={[rate]}
                      onValueChange={handleRateChange}
                      min={0.5}
                      max={2}
                      step={0.1}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Slower (0.5x)</span>
                      <span>Faster (2x)</span>
                    </div>
                  </div>

                  {/* Quick Speed Presets */}
                  <div className="flex gap-2">
                    {[0.5, 0.75, 1, 1.25, 1.5].map((presetRate) => (
                      <Button
                        key={presetRate}
                        size="sm"
                        variant={rate === presetRate ? 'default' : 'outline'}
                        onClick={() => handleRateChange([presetRate])}
                      >
                        {presetRate}x
                      </Button>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Text Display with Highlighting */}
        <div
          ref={containerRef}
          className="p-4 rounded-lg bg-muted/30 max-h-64 overflow-y-auto text-lg leading-relaxed"
        >
          {words.map((word, index) => {
            const isCurrentTTS = index === tts.currentWordIndex;
            const isCurrentGaze = showGazeComparison && index === gazeWordIndex;
            const isRead = index < tts.currentWordIndex;
            const isUpcoming = index > tts.currentWordIndex && index <= tts.currentWordIndex + 3;

            return (
              <motion.span
                key={index}
                data-word-index={index}
                className={`inline-block mr-1 px-0.5 rounded transition-all cursor-pointer ${
                  isCurrentTTS
                    ? 'bg-primary text-primary-foreground scale-105 font-medium'
                    : isCurrentGaze
                    ? 'ring-2 ring-green-500 bg-green-500/20'
                    : isRead
                    ? 'text-muted-foreground'
                    : isUpcoming
                    ? 'text-foreground/80'
                    : 'text-foreground'
                }`}
                onClick={() => tts.speakWord(word)}
                whileHover={{ scale: 1.05 }}
                animate={isCurrentTTS ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.2 }}
              >
                {word}
              </motion.span>
            );
          })}
        </div>

        {/* Gaze vs TTS Comparison */}
        {showGazeComparison && gazeWordIndex !== undefined && tts.currentWordIndex >= 0 && (
          <div className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary" />
              <span>TTS Position: Word {tts.currentWordIndex + 1}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded ring-2 ring-green-500 bg-green-500/50" />
              <span>Gaze Position: Word {gazeWordIndex + 1}</span>
            </div>
            {Math.abs(gazeWordIndex - tts.currentWordIndex) > 3 && (
              <Badge variant="destructive">Attention Drift Detected</Badge>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${tts.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Word {Math.max(0, tts.currentWordIndex + 1)} of {words.length}</span>
            <span>{Math.round(tts.progress)}%</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => skipToWord('prev')}
            disabled={!tts.isPlaying || tts.currentWordIndex <= 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          {tts.isPlaying && !tts.isPaused ? (
            <Button size="lg" onClick={tts.pause} className="gap-2">
              <Pause className="h-5 w-5" />
              Pause
            </Button>
          ) : (
            <Button size="lg" onClick={handlePlay} className="gap-2">
              <Play className="h-5 w-5" />
              {tts.isPaused ? 'Resume' : 'Play'}
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            onClick={tts.stop}
            disabled={!tts.isPlaying && !tts.isPaused}
          >
            <Square className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => skipToWord('next')}
            disabled={!tts.isPlaying || tts.currentWordIndex >= words.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Speed Quick Controls */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">Speed:</span>
          {[0.75, 1, 1.25, 1.5].map((presetRate) => (
            <Button
              key={presetRate}
              size="sm"
              variant={rate === presetRate ? 'secondary' : 'ghost'}
              onClick={() => handleRateChange([presetRate])}
            >
              {presetRate}x
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
