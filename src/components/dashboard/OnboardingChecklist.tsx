import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, Circle, Building2, UserSquare2, FileText, Mail, Users, X } from 'lucide-react';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export function OnboardingChecklist() {
  const { data: status, isLoading } = useOnboardingStatus();
  const [isDismissed, setIsDismissed] = useState(true); // Default to true to prevent flicker

  useEffect(() => {
    // Check local storage on mount
    const dismissed = localStorage.getItem('invoiceRescue_onboarding_dismissed');
    if (!dismissed) {
      setIsDismissed(false);
    }
  }, []);

  if (isLoading || !status || isDismissed || status.isComplete) {
    return null; // Hide if loading, completely finished, or dismissed
  }

  const handleDismiss = () => {
    localStorage.setItem('invoiceRescue_onboarding_dismissed', 'true');
    setIsDismissed(true);
  };

  const calculateProgress = () => {
    let completed = 0;
    const total = 6;
    if (status.hasOrganisation) completed++;
    if (status.hasEntity) completed++;
    if (status.hasCustomer) completed++;
    if (status.hasInvoice) completed++;
    if (status.hasGmail) completed++;
    if (status.hasTeam) completed++;
    return (completed / total) * 100;
  };

  const steps = [
    {
      id: 'org',
      title: 'Create organisation',
      isComplete: status.hasOrganisation,
      icon: <Building2 className="w-5 h-5" />,
      link: '/app/settings',
      optional: false,
    },
    {
      id: 'entity',
      title: 'Create entity',
      isComplete: status.hasEntity,
      icon: <Building2 className="w-5 h-5" />,
      link: '/app/settings',
      optional: false,
    },
    {
      id: 'customer',
      title: 'Add your first customer',
      isComplete: status.hasCustomer,
      icon: <UserSquare2 className="w-5 h-5" />,
      link: '/app/customers',
      optional: false,
    },
    {
      id: 'invoice',
      title: 'Upload your first invoice',
      isComplete: status.hasInvoice,
      icon: <FileText className="w-5 h-5" />,
      link: '/app/invoices',
      optional: false,
    },
    {
      id: 'gmail',
      title: 'Connect Gmail',
      isComplete: status.hasGmail,
      icon: <Mail className="w-5 h-5" />,
      link: '/app/settings',
      optional: true,
    },
    {
      id: 'team',
      title: 'Invite your finance team',
      isComplete: status.hasTeam,
      icon: <Users className="w-5 h-5" />,
      link: '/app/settings',
      optional: true,
    },
  ];

  return (
    <Card className="mb-6 relative overflow-hidden bg-gradient-to-br from-card to-muted/30 border-primary/20 shadow-sm animate-fade-in">
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
        title="Dismiss onboarding"
      >
        <X className="h-4 w-4" />
      </Button>
      
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Get started with InvoiceRescue</CardTitle>
        <CardDescription>Complete these steps to fully set up your workspace.</CardDescription>
        
        {/* Progress Bar */}
        <div className="w-full bg-secondary h-2 mt-4 rounded-full overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-1000 ease-in-out" 
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((step) => (
            <Link 
              key={step.id} 
              to={step.link}
              className={`flex items-start p-3 rounded-lg border transition-colors ${
                step.isComplete 
                  ? 'bg-muted/50 border-transparent opacity-70' 
                  : 'bg-card border-border hover:border-primary/50 hover:shadow-sm group'
              }`}
            >
              <div className="mr-3 mt-0.5">
                {step.isComplete ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                )}
              </div>
              <div className="flex-1">
                <p className={`font-medium text-sm ${step.isComplete ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {step.title}
                </p>
                {step.optional && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Optional</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
