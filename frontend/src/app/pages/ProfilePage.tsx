import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Briefcase, Save, ArrowLeft, Upload, CreditCard, Download, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [formData, setFormData] = useState({
    firstName: user?.profile.firstName || '',
    lastName: user?.profile.lastName || '',
    email: user?.email || '',
    phone: user?.profile.phone || '',
    location: user?.profile.location || '',
    role: user?.preferences.role || '',
    experienceLevel: user?.preferences.experienceLevel || 'entry',
    industries: user?.preferences.industries || [] as string[],
    interviewTypes: user?.preferences.interviewTypes || [] as string[],
  });

  const [newIndustry, setNewIndustry] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.profile.avatar || '');

  const experienceLevels = [
    { value: 'entry', label: 'Entry Level (0-2 years)' },
    { value: 'mid', label: 'Mid Level (2-5 years)' },
    { value: 'senior', label: 'Senior Level (5-10 years)' },
    { value: 'executive', label: 'Executive (10+ years)' },
  ];

  const interviewTypeOptions = [
    { value: 'behavioral', label: 'Behavioral' },
    { value: 'technical', label: 'Technical' },
    { value: 'coding', label: 'Coding' },
    { value: 'system-design', label: 'System Design' },
  ];

  // Fetch payment history on mount
  useEffect(() => {
    const fetchPaymentHistory = async () => {
      try {
        const response = await apiService.get('/payment/history');
        if (response.success && response.data) {
          setPaymentHistory(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch payment history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchPaymentHistory();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddIndustry = () => {
    if (newIndustry.trim() && !formData.industries.includes(newIndustry.trim())) {
      setFormData(prev => ({
        ...prev,
        industries: [...prev.industries, newIndustry.trim()]
      }));
      setNewIndustry('');
    }
  };

  const handleRemoveIndustry = (industry: string) => {
    setFormData(prev => ({
      ...prev,
      industries: prev.industries.filter(i => i !== industry)
    }));
  };

  const handleInterviewTypeToggle = (type: string) => {
    setFormData(prev => ({
      ...prev,
      interviewTypes: prev.interviewTypes.includes(type)
        ? prev.interviewTypes.filter(t => t !== type)
        : [...prev.interviewTypes, type]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Upload avatar if changed
      if (avatarFile) {
        const avatarFormData = new FormData();
        avatarFormData.append('avatar', avatarFile);
        
        // For now, just use the preview URL
        // In production, upload to Cloudinary via backend
        // const avatarResponse = await apiService.post('/user/upload-avatar', avatarFormData);
      }

      // Update profile
      const response = await apiService.put('/user/profile', {
        profile: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          location: formData.location,
          avatar: avatarPreview,
        },
        preferences: {
          role: formData.role,
          experienceLevel: formData.experienceLevel,
          industries: formData.industries,
          interviewTypes: formData.interviewTypes,
        },
      });

      if (response.success) {
        // Update local user state
        if (response.data) {
          setUser(response.data as any);
        }
        toast.success('Profile updated successfully!');
        navigate('/dashboard');
      } else {
        toast.error(response.error || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  };

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date));
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-gray-100 text-gray-800',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  return (
    <div className="min-h-screen py-20 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">Edit Profile</h1>
            <p className="text-muted-foreground">Update your personal information and preferences</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <Card className='p-6'>
            <h2 className="text-xl font-semibold mb-4">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center text-3xl font-bold text-white">
                    {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
                  </div>
                )}
                <label className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full cursor-pointer hover:bg-primary/90">
                  <Upload className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Upload a profile picture. Recommended size: 400x400px
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supported formats: JPG, PNG, GIF (max 2MB)
                </p>
              </div>
            </div>
          </Card>

          {/* Personal Information */}
          <Card className='p-6'>
            <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-2 border border-border rounded-lg bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 234 567 8900"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  <MapPin className="w-4 h-4 inline mr-2" />
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Mumbai, India"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </Card>

          {/* Professional Information */}
          <Card className='p-6'>
            <h2 className="text-xl font-semibold mb-4">Professional Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Briefcase className="w-4 h-4 inline mr-2" />
                  Current Role
                </label>
                <input
                  type="text"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  placeholder="e.g., Software Engineer, Product Manager"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Experience Level</label>
                <select
                  name="experienceLevel"
                  value={formData.experienceLevel}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {experienceLevels.map(level => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Industries / Skills</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddIndustry())}
                    placeholder="Add industry or skill"
                    className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button type="button" onClick={handleAddIndustry} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.industries.map((industry, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-primary rounded-full text-sm flex items-center gap-2"
                    >
                      {industry}
                      <button
                        type="button"
                        onClick={() => handleRemoveIndustry(industry)}
                        className="text-primary hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Preferred Interview Types</label>
                <div className="grid grid-cols-2 gap-3">
                  {interviewTypeOptions.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleInterviewTypeToggle(type.value)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        formData.interviewTypes.includes(type.value)
                          ? 'border-primary bg-blue-50'
                          : 'border-border bg-white hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          formData.interviewTypes.includes(type.value)
                            ? 'border-primary bg-primary'
                            : 'border-gray-300'
                        }`}>
                          {formData.interviewTypes.includes(type.value) && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                            </svg>
                          )}
                        </div>
                        <span className="font-medium">{type.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Payment History */}
          <Card className='p-6'>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Payment History</h2>
            </div>
            
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground mt-4">Loading payment history...</p>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">No payment history yet</p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/subscription')}
                  className="mt-4"
                >
                  View Subscription Plans
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment._id}
                    className="border border-border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">
                            {payment.plan.charAt(0).toUpperCase() + payment.plan.slice(1)} Plan
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(payment.status)}`}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Transaction ID:</span>{' '}
                            <span className="font-mono text-xs">{payment._id}</span>
                          </div>
                          <div>
                            <span className="font-medium">Date:</span>{' '}
                            {formatDate(payment.createdAt)}
                          </div>
                          {payment.paymentMethod && (
                            <div>
                              <span className="font-medium">Payment Method:</span>{' '}
                              {payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1)}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Amount:</span>{' '}
                            <span className="font-semibold text-primary">
                              {formatCurrency(payment.amount, payment.currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {payment.receiptUrl && (
                        <a
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-4 p-2 text-primary hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Receipt"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
