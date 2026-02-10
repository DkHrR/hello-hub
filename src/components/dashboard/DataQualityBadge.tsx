import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

interface CRAAPScore {
  currency: number;
  relevance: number;
  authority: number;
  accuracy: number;
  purpose: number;
}

interface DataQualityBadgeProps {
  score?: CRAAPScore | null;
  showDetails?: boolean;
}

function getGrade(total: number): { grade: string; color: string; icon: typeof Shield } {
  if (total >= 90) return { grade: 'A', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: ShieldCheck };
  if (total >= 75) return { grade: 'B', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: ShieldCheck };
  if (total >= 60) return { grade: 'C', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: Shield };
  if (total >= 40) return { grade: 'D', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: ShieldAlert };
  return { grade: 'F', color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: ShieldX };
}

export function calculateCRAAPScore(metadata: {
  publicationYear?: number;
  sampleSize?: number;
  sourceAuthority?: string;
  peerReviewed?: boolean;
  datasetType?: string;
}): CRAAPScore {
  const currentYear = new Date().getFullYear();
  const age = metadata.publicationYear ? currentYear - metadata.publicationYear : 10;
  const currency = Math.max(0, Math.min(100, 100 - (age * 8)));

  const relevance = metadata.datasetType === 'etdd70' ? 95 :
    metadata.datasetType === 'clinical' ? 85 : 60;

  const authority = metadata.peerReviewed ? 90 :
    metadata.sourceAuthority === 'university' ? 80 :
    metadata.sourceAuthority === 'clinic' ? 70 : 50;

  const sampleSize = metadata.sampleSize || 0;
  const accuracy = sampleSize >= 200 ? 95 :
    sampleSize >= 100 ? 85 :
    sampleSize >= 50 ? 70 :
    sampleSize >= 20 ? 55 : 30;

  const purpose = metadata.peerReviewed ? 90 : 65;

  return { currency, relevance, authority, accuracy, purpose };
}

export function DataQualityBadge({ score, showDetails = false }: DataQualityBadgeProps) {
  if (!score) {
    return (
      <Badge variant="outline" className="text-muted-foreground border-muted">
        <Shield className="w-3 h-3 mr-1" />
        Unscored
      </Badge>
    );
  }

  const total = Math.round((score.currency + score.relevance + score.authority + score.accuracy + score.purpose) / 5);
  const { grade, color, icon: Icon } = getGrade(total);

  const badge = (
    <Badge variant="outline" className={`${color} font-semibold`}>
      <Icon className="w-3 h-3 mr-1" />
      CRAAP: {grade} ({total}%)
    </Badge>
  );

  if (!showDetails) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="w-64 p-3">
        <p className="font-semibold mb-2">CRAAP Test Breakdown</p>
        <div className="space-y-1 text-xs">
          {[
            { label: 'Currency', value: score.currency },
            { label: 'Relevance', value: score.relevance },
            { label: 'Authority', value: score.authority },
            { label: 'Accuracy', value: score.accuracy },
            { label: 'Purpose', value: score.purpose },
          ].map(item => (
            <div key={item.label} className="flex justify-between">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{Math.round(item.value)}%</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
