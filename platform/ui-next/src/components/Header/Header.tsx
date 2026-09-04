import React, { ReactNode } from 'react';
import classNames from 'classnames';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Icons,
  Button,
  ToolButton,
} from '../';
import { IconPresentationProvider } from '@ohif/ui-next';

import NavBar from '../NavBar';

// Todo: we should move this component to composition and remove props base

interface HeaderProps {
  children?: ReactNode;
  menuOptions: Array<{
    title: string;
    icon?: string;
    onClick: () => void;
  }>;
  isReturnEnabled?: boolean;
  onClickReturnButton?: () => void;
  isSticky?: boolean;
  WhiteLabeling?: {
    createLogoComponentFn?: (React: any, props: any) => ReactNode;
  };
  PatientInfo?: ReactNode;
  Secondary?: ReactNode;
  UndoRedo?: ReactNode;
}

function Header({
  children,
  menuOptions,
  isReturnEnabled = false,
  onClickReturnButton,
  isSticky = false,
  WhiteLabeling,
  PatientInfo,
  UndoRedo,
  Secondary,
  ...props
}: HeaderProps): ReactNode {
  const onClickReturn = () => {
    if (isReturnEnabled && onClickReturnButton) {
      onClickReturnButton();
    }
  };

  return (
    <IconPresentationProvider
      size="large"
      IconContainer={ToolButton}
    >
      <NavBar
        isSticky={isSticky}
        {...props}
      >
        <div className="relative flex h-[48px] items-center justify-between px-1 md:block">
          {/* LOGO / RETURN */}
          <div className="flex min-w-0 flex-shrink items-center md:absolute md:left-0 md:top-1/2 md:flex-shrink-0 md:-translate-y-1/2">
            <div
              className={classNames(
                'mr-1 inline-flex min-w-0 items-center md:mr-3',
                isReturnEnabled && 'cursor-pointer'
              )}
              onClick={onClickReturn}
              data-cy="return-to-work-list"
            >
              {isReturnEnabled && (
                <Icons.ArrowLeft className="text-primary ml-1 h-5 w-5 flex-shrink-0 md:h-7 md:w-7" />
              )}
              <div className="ml-1 min-w-0 overflow-hidden md:max-w-none md:overflow-visible">
                {WhiteLabeling?.createLogoComponentFn?.(React, props) || <Icons.OHIFLogo />}
              </div>
            </div>
          </div>

          {/* SECONDARY (oculto en mobile) */}
          <div className="hidden md:absolute md:left-[250px] md:top-1/2 md:block md:h-8 md:-translate-y-1/2">
            {Secondary}
          </div>

          {/* TOOLBAR CENTRAL (scroll horizontal en mobile) */}
          <div
            className="scrollbar-hide mx-1 flex flex-1 items-center justify-start overflow-x-auto
                       md:absolute md:left-1/2 md:top-1/2 md:mx-0 md:flex-none md:-translate-x-1/2
                       md:-translate-y-1/2 md:justify-center md:overflow-visible"
          >
            <div className="flex items-center space-x-1 md:space-x-2">{children}</div>
          </div>

          {/* DERECHA: UndoRedo, PatientInfo, Settings */}
          <div className="flex flex-shrink-0 select-none items-center md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2">
            <div className="hidden md:block">{UndoRedo}</div>
            <div className="border-primary-dark mx-1.5 hidden h-[25px] border-r md:block"></div>
            {PatientInfo}
            <div className="border-primary-dark mx-1.5 h-[25px] border-r"></div>
            <div className="flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:bg-primary-dark mt-2 h-full w-full"
                  >
                    <Icons.GearSettings />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuOptions.map((option, index) => {
                    const IconComponent = option.icon
                      ? Icons[option.icon as keyof typeof Icons]
                      : null;
                    return (
                      <DropdownMenuItem
                        key={index}
                        onSelect={option.onClick}
                        className="flex items-center gap-2 py-2"
                      >
                        {IconComponent && (
                          <span className="flex h-4 w-4 items-center justify-center">
                            <Icons.ByName name={option.icon} />
                          </span>
                        )}
                        <span className="flex-1">{option.title}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </NavBar>
    </IconPresentationProvider>
  );
}

export default Header;
