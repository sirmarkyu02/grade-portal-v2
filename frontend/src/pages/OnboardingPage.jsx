import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, User, Phone, MapPin, Lock, Check, ArrowRight, GraduationCap } from 'lucide-react';
import { useAuth } from '../App';
import api from '../api';
import toast from 'react-hot-toast';

export default function OnboardingPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileRef = useRef();

  const [form, setForm] = useState({
    newPassword: '',
    confirmPassword: '',
    contactNo: '',
    parentName: '',
    parentContactNo: '',
    address: '',
  });
  const [errors, setErrors] = useState({});

  const set = (field, val) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: '' }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo must be under 5MB'); return; }
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const validateStep1 = () => {
    const errs = {};
    if (!form.newPassword || form.newPassword.length < 6) errs.newPassword = 'Password must be at least 6 characters.';
    if (form.newPassword !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    if (!form.contactNo.trim()) errs.contactNo = 'Contact number is required.';
    if (!form.parentName.trim()) errs.parentName = 'Parent/Guardian name is required.';
    if (!form.parentContactNo.trim()) errs.parentContactNo = 'Parent/Guardian contact is required.';
    if (!form.address.trim()) errs.address = 'Address is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFinish = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('newPassword', form.newPassword);
      fd.append('contactNo', form.contactNo);
      fd.append('parentName', form.parentName);
      fd.append('parentContactNo', form.parentContactNo);
      fd.append('address', form.address);
      if (photo) fd.append('photo', photo);
      await api.post('/student/onboard', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refresh();
      toast.success('Profile setup complete! Welcome to Grade Portal.');
      navigate('/student');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Setup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { n: 1, label: 'Password' },
    { n: 2, label: 'Profile' },
    { n: 3, label: 'Photo' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--grad-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 560, width: '100%', borderRadius: 24, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'var(--grad-hero)', padding: '32px 32px 24px', color: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={22} color="white" />
            </div>
            <div>
              <p style={{ opacity: 0.8, fontSize: '0.8125rem' }}>Welcome,</p>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{user?.name}</h2>
            </div>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: 4 }}>Let's set up your profile</h3>
          <p style={{ opacity: 0.8, fontSize: '0.875rem' }}>Complete your profile to access all features. This only takes a minute!</p>
          {/* Step indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
            {steps.map((s, i) => (
              <React.Fragment key={s.n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 700, background: step > s.n ? 'rgba(255,255,255,0.9)' : step === s.n ? 'white' : 'rgba(255,255,255,0.25)', color: step > s.n ? 'var(--violet-700)' : step === s.n ? 'var(--violet-700)' : 'white' }}>
                    {step > s.n ? <Check size={14} /> : s.n}
                  </div>
                  <span style={{ fontSize: '0.75rem', opacity: step === s.n ? 1 : 0.7, fontWeight: step === s.n ? 600 : 400 }}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: step > s.n ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', borderRadius: 2 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 32 }}>
          {/* Step 1: Password */}
          {step === 1 && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Create your password</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Choose a secure password for your account. Your default password was your Student ID.</p>
              </div>
              <div className="form-group">
                <label className="form-label">New Password <span>*</span></label>
                <div className="input-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input className={`form-input has-icon ${errors.newPassword ? 'error' : ''}`} type="password" placeholder="At least 6 characters" value={form.newPassword} onChange={e => set('newPassword', e.target.value)} />
                </div>
                {errors.newPassword && <p className="form-error">{errors.newPassword}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password <span>*</span></label>
                <div className="input-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input className={`form-input has-icon ${errors.confirmPassword ? 'error' : ''}`} type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
                </div>
                {errors.confirmPassword && <p className="form-error">{errors.confirmPassword}</p>}
              </div>
              <button className="btn btn-primary" onClick={() => { if (validateStep1()) setStep(2); }} style={{ marginTop: 8 }}>
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {step === 2 && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Personal information</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>This information helps the school reach you and your guardians.</p>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Your Contact No. <span>*</span></label>
                  <div className="input-wrapper">
                    <Phone size={16} className="input-icon" />
                    <input className={`form-input has-icon ${errors.contactNo ? 'error' : ''}`} type="tel" placeholder="09XX-XXX-XXXX" value={form.contactNo} onChange={e => set('contactNo', e.target.value)} />
                  </div>
                  {errors.contactNo && <p className="form-error">{errors.contactNo}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Parent/Guardian Name <span>*</span></label>
                  <div className="input-wrapper">
                    <User size={16} className="input-icon" />
                    <input className={`form-input has-icon ${errors.parentName ? 'error' : ''}`} type="text" placeholder="Full name" value={form.parentName} onChange={e => set('parentName', e.target.value)} />
                  </div>
                  {errors.parentName && <p className="form-error">{errors.parentName}</p>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Parent/Guardian Contact No. <span>*</span></label>
                <div className="input-wrapper">
                  <Phone size={16} className="input-icon" />
                  <input className={`form-input has-icon ${errors.parentContactNo ? 'error' : ''}`} type="tel" placeholder="09XX-XXX-XXXX" value={form.parentContactNo} onChange={e => set('parentContactNo', e.target.value)} />
                </div>
                {errors.parentContactNo && <p className="form-error">{errors.parentContactNo}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Address <span>*</span></label>
                <div className="input-wrapper">
                  <MapPin size={16} className="input-icon" />
                  <input className={`form-input has-icon ${errors.address ? 'error' : ''}`} type="text" placeholder="Street, Barangay, City" value={form.address} onChange={e => set('address', e.target.value)} />
                </div>
                {errors.address && <p className="form-error">{errors.address}</p>}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={() => { if (validateStep2()) setStep(3); }} style={{ flex: 2 }}>
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Photo */}
          {step === 3 && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Profile photo</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Add a photo to personalize your account. You can skip this step.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div className="photo-upload" onClick={() => fileRef.current.click()} style={{ width: 120, height: 120 }}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--brand-300)' }} />
                  ) : (
                    <div className="photo-preview">
                      <User size={40} />
                    </div>
                  )}
                  <div className="photo-overlay">
                    <Camera size={22} />
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()}>
                  <Camera size={14} /> {photoPreview ? 'Change photo' : 'Upload photo'}
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max size: 5MB. JPG, PNG, or GIF.</p>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>Back</button>
                <button className="btn btn-primary" onClick={handleFinish} disabled={loading} style={{ flex: 2 }}>
                  {loading ? (
                    <><svg className="spinner spinner-sm" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" /></svg> Saving...</>
                  ) : <><Check size={16} /> Complete Setup</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
