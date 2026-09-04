import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Icons } from '@ohif/ui-next';
import { Button } from '../Button';
import { useTranslation } from 'react-i18next';

export enum showDialogOption {
  NeverShowDialog = 'never',
  AlwaysShowDialog = 'always',
  ShowOnceAndConfigure = 'configure',
}

const InvestigationalUseDialog = ({
  dialogConfiguration = {
    option: showDialogOption.AlwaysShowDialog,
  },
}) => {
  const { option, days } = dialogConfiguration;
  const [isHidden, setIsHidden] = useState(true);
  const { t } = useTranslation('InvestigationalUseDialog');

  useEffect(() => {
    const dialogLocalState = localStorage.getItem('investigationalUseDialog');
    const dialogSessionState = sessionStorage.getItem('investigationalUseDialog');

    switch (option) {
      case showDialogOption.NeverShowDialog:
        setIsHidden(true);
        break;
      case showDialogOption.AlwaysShowDialog:
        setIsHidden(!!dialogSessionState);
        break;
      case showDialogOption.ShowOnceAndConfigure:
        if (dialogLocalState) {
          const { expiryDate } = JSON.parse(dialogLocalState);
          const isExpired = new Date() > new Date(expiryDate);
          setIsHidden(!isExpired);
        } else {
          setIsHidden(false);
        }
        break;
      default:
        setIsHidden(true);
    }
  }, [option, days]);

  const handleConfirmAndHide = () => {
    const expiryDate = new Date();

    switch (option) {
      case showDialogOption.ShowOnceAndConfigure:
        expiryDate.setDate(expiryDate.getDate() + days);
        localStorage.setItem('investigationalUseDialog', JSON.stringify({ expiryDate }));
        break;
      case showDialogOption.AlwaysShowDialog:
        sessionStorage.setItem('investigationalUseDialog', 'hidden');
        break;
    }
    setIsHidden(true);
  };

  if (isHidden) {
    return null;
  }

  return (
    // Antes: h-[86px] fijo -> en celular el texto se envolvía y quedaba cortado.
    // Ahora: alto automático (h-auto), padding y tamaños de fuente que se reducen en pantallas chicas (sm:)
    <div className="fixed inset-x-0 bottom-2 z-50 flex justify-center px-2">
      <div
        className="
          bg-secondary-dark border-primary-dark
          flex w-full max-w-[560px]
          flex-col gap-3 rounded-lg border-2 p-3
          shadow-lg
          sm:w-[90%] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-[10px] sm:pl-[22px] sm:pr-[22px]
        "
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Icons.InvestigationalUse className="h-10 w-10 shrink-0 sm:h-18 sm:w-18" />
          <div className="flex min-w-0 flex-col">
            <div className="text-[15px] leading-tight text-black sm:whitespace-nowrap sm:text-[19px]">
              Visualizador de estudios{' '}
              <span className="text-primary-light block sm:inline">
                {t('Clinica San Antonio')}
              </span>
            </div>
            <div className="text-[11px] leading-tight text-white sm:text-[13px]">
              <span
                className="text-primary-active cursor-pointer"
                onClick={() => window.open('https://clinicasanantonio.com/', '_blank')}
              >
                {t('Para mas información visita la pagina de Clinica san Antonio')}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={handleConfirmAndHide}
          className="bg-primary-main w-full sm:w-auto"
          dataCY="confirm-and-hide-button"
        >
          {t('Continuar')}
        </Button>
      </div>
    </div>
  );
};

InvestigationalUseDialog.propTypes = {
  dialogConfiguration: PropTypes.shape({
    option: PropTypes.oneOf(Object.values(showDialogOption)).isRequired,
    days: PropTypes.number,
  }),
};

export default InvestigationalUseDialog;
