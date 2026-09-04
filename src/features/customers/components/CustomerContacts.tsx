import { useState } from 'react';
import { Plus, Mail, Phone, Briefcase, Star, Trash2, Edit2 } from 'lucide-react';
import { useCustomerContacts, type CustomerContact } from '@/hooks/useCustomers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type Props = {
  customerId: string;
  contacts: CustomerContact[];
};

export function CustomerContacts({ customerId, contacts }: Props) {
  const { createContact, updateContact, deleteContact } = useCustomerContacts(customerId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);

  const [formData, setFormData] = useState<Partial<CustomerContact>>({
    name: '',
    email: '',
    phone: '',
    job_title: '',
    role: 'general',
    is_primary: false,
    receives_collection_emails: false,
  });

  const handleOpenDialog = (contact?: CustomerContact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData(contact);
    } else {
      setEditingContact(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        job_title: '',
        role: 'general',
        is_primary: false,
        receives_collection_emails: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingContact) {
        await updateContact.mutateAsync({ id: editingContact.id, updates: formData });
        toast.success('Contact updated');
      } else {
        await createContact.mutateAsync(formData);
        toast.success('Contact added');
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save contact');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await deleteContact.mutateAsync(id);
      toast.success('Contact deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Contacts</h3>
          <p className="text-sm text-muted-foreground">Manage people associated with this customer.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Add Contact
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((contact) => (
          <div key={contact.id} className={`p-4 rounded-lg border ${contact.is_primary ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">{contact.name}</h4>
                  {contact.is_primary && <Star className="h-3 w-3 fill-primary text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground capitalize flex items-center gap-1 mt-1">
                  <Briefcase className="h-3 w-3" /> {contact.job_title || 'No Title'} • {contact.role.replace('_', ' ')}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => handleOpenDialog(contact)}>
                  <Edit2 className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(contact.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-1.5 mt-4">
              {contact.email && (
                <div className="flex items-center text-sm">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">{contact.email}</a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center text-sm">
                  <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                  <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">{contact.phone}</a>
                </div>
              )}
            </div>

            {contact.receives_collection_emails && (
              <div className="mt-3 inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                Receives Collection Emails
              </div>
            )}
          </div>
        ))}

        {contacts.length === 0 && (
          <div className="col-span-full py-8 text-center border border-dashed rounded-lg">
            <p className="text-sm text-muted-foreground">No contacts added yet.</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input value={formData.job_title || ''} onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(v: any) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role">
                      {formData.role ? formData.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "Select role"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accounts_payable">Accounts Payable</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="procurement">Procurement</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="management">Management</SelectItem>
                    <SelectItem value="escalation">Escalation</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-4">
              <Checkbox 
                id="is_primary" 
                checked={formData.is_primary} 
                onCheckedChange={(c: boolean) => setFormData({ ...formData, is_primary: c })} 
              />
              <Label htmlFor="is_primary">Primary Contact</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="receives_emails" 
                checked={formData.receives_collection_emails} 
                onCheckedChange={(c: boolean) => setFormData({ ...formData, receives_collection_emails: c })} 
              />
              <Label htmlFor="receives_emails">Receives Collection Emails</Label>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit">{editingContact ? 'Save Changes' : 'Add Contact'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
