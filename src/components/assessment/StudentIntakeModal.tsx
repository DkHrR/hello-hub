import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, GraduationCap, Calendar, ArrowRight, X, Languages } from 'lucide-react';
import { availableLanguages } from '@/data/regionalPassages';

interface StudentIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StudentIntakeData) => void;
}

export interface StudentIntakeData {
  name: string;
  age: number;
  grade: string;
  language?: string;
}

const GRADES = [
  { value: 'K', label: 'Kindergarten' },
  { value: '1st', label: '1st Grade' },
  { value: '2nd', label: '2nd Grade' },
  { value: '3rd', label: '3rd Grade' },
  { value: '4th', label: '4th Grade' },
  { value: '5th', label: '5th Grade' },
];

const AGES = [5, 6, 7, 8, 9, 10, 11];

export function StudentIntakeModal({ isOpen, onClose, onSubmit }: StudentIntakeModalProps) {
  const [name, setName] = useState('');
  const [age, setAge] = useState<number | undefined>();
  const [grade, setGrade] = useState<string | undefined>();
  const [language, setLanguage] = useState<string>('en');
  const [errors, setErrors] = useState<{ name?: string; age?: string; grade?: string }>({});

  const validate = () => {
    const newErrors: { name?: string; age?: string; grade?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'Please enter the student\'s name';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!age) {
      newErrors.age = 'Please select the student\'s age';
    }
    
    if (!grade) {
      newErrors.grade = 'Please select the student\'s grade';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validate() && age && grade) {
      onSubmit({ name: name.trim(), age, grade, language });
    }
  };

  const handleClose = () => {
    setName('');
    setAge(undefined);
    setGrade(undefined);
    setLanguage('en');
    setErrors({});
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-md"
          >
            <Card className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4"
                onClick={handleClose}
              >
                <X className="w-4 h-4" />
              </Button>
              
              <CardHeader className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-neuro flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-primary-foreground" />
                </div>
                <CardTitle className="text-2xl">Student Information</CardTitle>
                <CardDescription>
                  Please provide the student's details before starting the assessment
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name Input */}
                  <div className="space-y-2">
                    <Label htmlFor="student-name" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Student Name
                    </Label>
                    <Input
                      id="student-name"
                      type="text"
                      placeholder="Enter student's full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={errors.name ? 'border-destructive' : ''}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name}</p>
                    )}
                  </div>
                  
                  {/* Age Select */}
                  <div className="space-y-2">
                    <Label htmlFor="student-age" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Age (5-11 years only)
                    </Label>
                    <Select value={age?.toString()} onValueChange={(v) => setAge(parseInt(v))}>
                      <SelectTrigger className={errors.age ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select age" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGES.map(a => (
                          <SelectItem key={a} value={a.toString()}>
                            {a} years old
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.age && (
                      <p className="text-sm text-destructive">{errors.age}</p>
                    )}
                  </div>
                  
                  {/* Grade Select */}
                  <div className="space-y-2">
                    <Label htmlFor="student-grade" className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Grade Level (K-5th only)
                    </Label>
                    <Select value={grade} onValueChange={setGrade}>
                      <SelectTrigger className={errors.grade ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADES.map(g => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.grade && (
                      <p className="text-sm text-destructive">{errors.grade}</p>
                    )}
                  </div>
                  
                  {/* Language Select */}
                  <div className="space-y-2">
                    <Label htmlFor="student-language" className="flex items-center gap-2">
                      <Languages className="w-4 h-4" />
                      Assessment Language
                    </Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLanguages.map(lang => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.nativeName} ({lang.name})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Reading passages will be in the selected language
                    </p>
                  </div>
                  
                  <div className="pt-4">
                    <Button type="submit" variant="hero" className="w-full">
                      Continue to Assessment
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </div>
                </form>
                
                <p className="text-xs text-muted-foreground text-center mt-4">
                  This information will be used for the diagnostic report
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
