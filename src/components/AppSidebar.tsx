import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, 
  DollarSign, 
  Plus, 
  Receipt, 
  BarChart3, 
  LogOut,
  User
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const menuItems = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Empréstimos', url: '/loans', icon: DollarSign },
  { title: 'Novo Empréstimo', url: '/loans/new', icon: Plus },
  { title: 'Recebimentos', url: '/payments', icon: Receipt },
  { title: 'Relatórios', url: '/reports', icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const currentPath = location.pathname;
  const isCollapsed = state === 'collapsed';

  const isActive = (path: string) => {
    if (path === '/') {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  const getNavClassName = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
      : 'hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      end={item.url === '/'} 
                      className={({ isActive }) => getNavClassName({ isActive })}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {!isCollapsed && (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-sm text-sidebar-foreground">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4" />
                      <span className="truncate">{user?.email}</span>
                    </div>
                  </div>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Button
                    variant="ghost"
                    onClick={signOut}
                    className="w-full justify-start"
                  >
                    <LogOut className="h-4 w-4" />
                    {!isCollapsed && <span>Sair</span>}
                  </Button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}