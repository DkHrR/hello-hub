import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, UserPlus, Users, Eye } from 'lucide-react';
import { differenceInYears } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;

const GRADES = ['K', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

export default function Students() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state - aligned with database schema
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    grade_level: '',
    notes: '',
  });

  // Helper to calculate age
  const calculateAge = (dateOfBirth: string | null): number | null => {
    if (!dateOfBirth) return null;
    return differenceInYears(new Date(), new Date(dateOfBirth));
  };

  // Helper to get full name
  const getFullName = (student: Student): string => {
    return `${student.first_name} ${student.last_name || ''}`.trim();
  };

  // Fetch students
  const { data: students, isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Student[];
    },
    enabled: !!user
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (student: Omit<typeof formData, ''> & { created_by: string }) => {
      const { data, error } = await supabase
        .from('students')
        .insert([{
          first_name: student.first_name,
          last_name: student.last_name,
          date_of_birth: student.date_of_birth || null,
          grade_level: student.grade_level || null,
          notes: student.notes || null,
          created_by: student.created_by,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setIsCreateOpen(false);
      resetForm();
      toast.success('Student added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add student: ' + error.message);
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<typeof formData> }) => {
      const { data, error } = await supabase
        .from('students')
        .update({
          first_name: updates.first_name,
          last_name: updates.last_name,
          date_of_birth: updates.date_of_birth || null,
          grade_level: updates.grade_level || null,
          notes: updates.notes || null,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setEditingStudent(null);
      resetForm();
      toast.success('Student updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update student: ' + error.message);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setDeleteConfirm(null);
      toast.success('Student removed successfully');
    },
    onError: (error) => {
      toast.error('Failed to remove student: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      grade_level: '',
      notes: '',
    });
  };

  const handleCreate = () => {
    if (!user) return;
    if (!formData.first_name || !formData.last_name) {
      toast.error('Please fill in the required fields');
      return;
    }
    
    createMutation.mutate({
      ...formData,
      created_by: user.id
    });
  };

  const handleUpdate = () => {
    if (!editingStudent) return;
    
    updateMutation.mutate({
      id: editingStudent.id,
      updates: formData
    });
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      first_name: student.first_name,
      last_name: student.last_name || '',
      date_of_birth: student.date_of_birth || '',
      grade_level: student.grade_level || '',
      notes: student.notes || '',
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-24 pb-16">
          <div className="container text-center">
            <h1 className="text-2xl font-bold mb-4">Please sign in to manage students</h1>
            <Button onClick={() => navigate('/auth')}>Sign In</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Users className="w-8 h-8 text-primary" />
                Student Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Add, edit, and manage student profiles for diagnostic assessments
              </p>
            </div>
            
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Student</DialogTitle>
                  <DialogDescription>
                    Enter the student's information to create their profile.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name *</Label>
                      <Input
                        id="first_name"
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="First name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name *</Label>
                      <Input
                        id="last_name"
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date_of_birth">Date of Birth</Label>
                      <Input
                        id="date_of_birth"
                        type="date"
                        value={formData.date_of_birth}
                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grade_level">Grade</Label>
                      <Select
                        value={formData.grade_level}
                        onValueChange={(value) => setFormData({ ...formData, grade_level: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADES.map((grade) => (
                            <SelectItem key={grade} value={grade}>
                              {grade === 'K' ? 'Kindergarten' : `${grade} Grade`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Any additional notes..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleCreate}
                    disabled={!formData.first_name || !formData.last_name || createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Adding...' : 'Add Student'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Students</p>
                    <p className="text-2xl font-bold">{students?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Students Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Students</CardTitle>
              <CardDescription>View and manage all student profiles</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                </div>
              ) : students && students.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {getFullName(student)}
                        </TableCell>
                        <TableCell>{calculateAge(student.date_of_birth) ?? '-'}</TableCell>
                        <TableCell>{student.grade_level || '-'}</TableCell>
                        <TableCell>{new Date(student.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/student/${student.id}`)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(student)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteConfirm(student.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No students yet</h3>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Student
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Dialog */}
          <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Student</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Grade</Label>
                    <Select value={formData.grade_level} onValueChange={(value) => setFormData({ ...formData, grade_level: value })}>
                      <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                      <SelectContent>
                        {GRADES.map((grade) => (<SelectItem key={grade} value={grade}>{grade}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingStudent(null)}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation */}
          <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Student?</DialogTitle>
                <DialogDescription>This action cannot be undone.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <Footer />
    </div>
  );
}