import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader2, Activity, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type JobRun = {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  processed_count: number;
  failed_count: number;
  error_summary: string | null;
};

export function SystemHealth() {
  const [recentJobs, setRecentJobs] = useState<JobRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('job_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          setRecentJobs(data);
        }
      } catch (err) {
        console.error("Failed to load jobs", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();

    // Setup realtime subscription
    const subscription = supabase
      .channel('job_runs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_runs' }, fetchJobs)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running': return <Clock className="h-5 w-5 text-amber-500" />;
      default: return <AlertCircle className="h-5 w-5 text-neutral-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="default" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Completed</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'running': return <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">Running</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-600" />
            System Health & Background Jobs
          </CardTitle>
          <CardDescription>
            Monitor the status of internal CRON jobs, email syncs, and risk analysis engines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-neutral-300" />
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="text-center p-8 text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-100/50">
              No background jobs have executed recently.
            </div>
          ) : (
            <div className="space-y-4">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-start justify-between p-4 rounded-lg border border-neutral-200 bg-white">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      {getStatusIcon(job.status)}
                    </div>
                    <div>
                      <h4 className="font-medium text-neutral-900 flex items-center gap-2">
                        {job.job_name}
                        {getStatusBadge(job.status)}
                      </h4>
                      <p className="text-sm text-neutral-500 mt-1">
                        Started {formatDistanceToNow(new Date(job.started_at), { addSuffix: true })}
                        {job.completed_at && ` • Duration: ${Math.max(1, Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000))}s`}
                      </p>
                      
                      {(job.processed_count > 0 || job.failed_count > 0) && (
                        <p className="text-sm font-medium text-neutral-700 mt-2">
                          Processed: {job.processed_count} | Failed: {job.failed_count}
                        </p>
                      )}

                      {job.error_summary && (
                        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100 font-mono overflow-auto max-w-xl">
                          {job.error_summary}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-neutral-400 font-mono">
                    {format(new Date(job.started_at), 'HH:mm:ss')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
