import React from 'react';
import { DatasetUploader } from '@/components/dataset/DatasetUploader';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DatasetUpload() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dataset Management</h1>
            <p className="text-sm text-muted-foreground">Upload and manage ETDD-70 dataset files</p>
          </div>
        </div>
        <DatasetUploader />
      </div>
    </div>
  );
}
