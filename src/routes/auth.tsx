import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
export const Route=createFileRoute('/auth')({head:()=>({meta:[{title:'Acesso administrativo | Majesta Embalagens'},{name:'description',content:'Entrar na área administrativa da Majesta.'},{property:'og:title',content:'Acesso administrativo | Majesta'},{property:'og:description',content:'Gestão de produtos e contatos.'},{name:'robots',content:'noindex'}]}),component:Auth});
function Auth(){
 const nav=useNavigate();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 useEffect(()=>{supabase.auth.getUser().then(({data})=>{if(data.user)nav({to:'/admin'});});},[nav]);
 async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);const r=await supabase.auth.signInWithPassword({email,password});setBusy(false);if(r.error)setError('Não foi possível entrar. Verifique e-mail e senha.');else nav({to:'/admin'});}
 async function google(){setError('');const r=await lovable.auth.signInWithOAuth('google',{redirect_uri:`${window.location.origin}/auth`});if(r.error)setError('Não foi possível entrar com Google.');else if(!r.redirected)nav({to:'/admin'});}
 return <section className="mx-auto max-w-md px-5 py-16"><h1 className="text-3xl font-bold text-navy">Área administrativa</h1><form onSubmit={signIn} className="mt-8 space-y-4"><label className="block text-sm">E-mail<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="admin-input"/></label><label className="block text-sm">Senha<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} className="admin-input"/></label><Button disabled={busy} type="submit" className="w-full">Entrar</Button></form><Button variant="outline" onClick={google} className="mt-3 w-full">Entrar com Google</Button><Link to="/reset-password" className="mt-4 block text-sm underline">Esqueci minha senha</Link>{error&&<p role="alert" className="mt-4 text-destructive">{error}</p>}</section>;
}
