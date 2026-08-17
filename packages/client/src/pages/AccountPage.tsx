import React,{useEffect,useRef,useState}from'react';import{useAuthStore}from'../stores/authStore';import{authApi}from'../services/apiService';import{ShellPage,Section}from'../components/common/WorkspaceUI';import{Button,FormField,TextInput,showToast}from'../components/ui';import{Camera,KeyRound,Lock,Save}from'lucide-react';

const readFileAsDataURL=(file:File):Promise<string>=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)});

export const AccountPage:React.FC=()=>{const{user,updateUser}=useAuthStore();const fileRef=useRef<HTMLInputElement>(null);const[profile,setProfile]=useState({username:'',firstName:'',lastName:'',phone:'',avatarUrl:''});const[saving,setSaving]=useState(false);const[preview,setPreview]=useState<string|null>(null);const[password,setPassword]=useState({currentPassword:'',newPassword:'',confirmPassword:''});const[changing,setChanging]=useState(false);

useEffect(()=>{if(user)setProfile({username:user.username||'',firstName:user.firstName||'',lastName:user.lastName||'',phone:user.phone||'',avatarUrl:user.avatarUrl||''})},[user]);

const onPickAvatar=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){showToast('error','Please choose an image file');return}if(file.size>2*1024*1024){showToast('error','Image must be smaller than 2MB');return}try{const url=await readFileAsDataURL(file);setPreview(url)}catch{showToast('error','Unable to read image')}finally{e.target.value=''}};

const saveProfile=async(e:React.FormEvent)=>{e.preventDefault();setSaving(true);try{const data=await authApi.updateProfile({...profile,phone:profile.phone||null,avatarUrl:preview??(profile.avatarUrl||null)});updateUser(data as any);showToast('success','Profile updated');setPreview(null)}catch(err){showToast('error',err instanceof Error?err.message:'Unable to update profile')}finally{setSaving(false)}};

const changePassword=async(e:React.FormEvent)=>{e.preventDefault();setChanging(true);try{await authApi.changePassword(password.currentPassword,password.newPassword,password.confirmPassword);showToast('success','Password changed. Please sign in again.');setTimeout(()=>void useAuthStore.getState().logout(),800)}catch(err){showToast('error',err instanceof Error?err.message:'Unable to change password')}finally{setChanging(false)}};

const initials=`${(user?.firstName||'')[0]??''}${(user?.lastName||'')[0]??''}`.toUpperCase()||'NS';

return <ShellPage eyebrow="ACCOUNT" title="My account" subtitle="Manage your profile details, avatar and sign-in security.">
  <div className="grid gap-6 lg:grid-cols-3">
    <Section title="Profile photo" subtitle="PNG, JPG or GIF up to 2MB.">
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full ring-4 ring-[#e8f2f4]">{preview?<img src={preview} alt="avatar" className="h-full w-full object-cover"/>:user?.avatarUrl?<img src={user.avatarUrl} alt="avatar" className="h-full w-full object-cover"/>:<span className="text-3xl font-extrabold text-white bg-[#16a4d4] flex h-full w-full items-center justify-center">{initials}</span>}</div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar}/>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={()=>fileRef.current?.click()}><Camera size={14}/> {preview?'Choose different':'Upload photo'}</Button>
          {(preview||user?.avatarUrl)&&<Button variant="ghost" size="sm" onClick={()=>{setPreview(null);setProfile(p=>({...p,avatarUrl:''}))}}>Remove</Button>}
        </div>
        <p className="text-center text-[11px] leading-5 text-[#8a9598]">This photo appears in the top bar next to your name.</p>
      </div>
    </Section>

    <div className="space-y-6 lg:col-span-2">
      <Section title="Profile details" subtitle="Your name, username and contact information.">
        <form onSubmit={saveProfile} className="grid gap-4 p-5 sm:grid-cols-2">
          <FormField label="Username" required><TextInput required value={profile.username} onChange={e=>setProfile(p=>({...p,username:e.target.value}))} placeholder="username"/></FormField>
          <FormField label="Email"><TextInput disabled value={user?.email||''} className="bg-[#f2f4f2] text-[#8a9598]"/></FormField>
          <FormField label="First name" required><TextInput required value={profile.firstName} onChange={e=>setProfile(p=>({...p,firstName:e.target.value}))} placeholder="First name"/></FormField>
          <FormField label="Last name" required><TextInput required value={profile.lastName} onChange={e=>setProfile(p=>({...p,lastName:e.target.value}))} placeholder="Last name"/></FormField>
          <FormField label="Phone"><TextInput value={profile.phone} onChange={e=>setProfile(p=>({...p,phone:e.target.value}))} placeholder="+233 …"/></FormField>
          <div className="flex items-end"><Button type="submit" loading={saving}><Save size={14}/> Save changes</Button></div>
        </form>
      </Section>

      <Section title="Security" subtitle="Update your password. You will be signed out after the change.">
        <form onSubmit={changePassword} className="grid gap-4 p-5 sm:grid-cols-3">
          <FormField label="Current password" required><TextInput required type="password" value={password.currentPassword} onChange={e=>setPassword(p=>({...p,currentPassword:e.target.value}))} placeholder="••••••••"/></FormField>
          <FormField label="New password" required><TextInput required type="password" value={password.newPassword} onChange={e=>setPassword(p=>({...p,newPassword:e.target.value}))} placeholder="Min. 8 chars, 1 upper, 1 number, 1 symbol"/></FormField>
          <FormField label="Confirm new password" required><TextInput required type="password" value={password.confirmPassword} onChange={e=>setPassword(p=>({...p,confirmPassword:e.target.value}))} placeholder="Repeat new password"/></FormField>
          <div className="sm:col-span-3 flex items-center justify-between border-t border-[#e9ecea] pt-4">
            <p className="flex items-center gap-2 text-[11px] text-[#8a9598]"><Lock size={13}/> Uses Argon2id password hashing.</p>
            <Button type="submit" variant="danger" loading={changing}><KeyRound size={14}/> Change password</Button>
          </div>
        </form>
      </Section>
    </div>
  </div>
</ShellPage>};export default AccountPage;