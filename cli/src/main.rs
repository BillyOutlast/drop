use clap::Parser;
use downpour::commands::connect::config::manage_configuration;
use downpour::commands::upload;
use downpour::{
    cli::{Cli, Commands},
    commands::connect::config::Config,
};

/// Runs the Downpour command-line interface.
///
/// # Returns
///
/// `Ok(())` when the selected command completes successfully.
///
/// # Examples
///
/// ```
/// # fn main() {
/// // The command-line executable invokes this entry point automatically.
/// # assert!(true);
/// # }
/// ```
async fn main() -> anyhow::Result<()> {
    downpour::logging::configure_logging()?;

    let cli = Cli::parse();

    let mut config = Config::read();
    match cli.command {
        Commands::Connect { name, option } => {
            manage_configuration(&mut config, name, option).await?
        }
        Commands::Upload { info, name } => {
            let info = info.interactive_configure();
            upload::interface::upload(&info, config, &name).await?;
        }
    };

    Ok(())
}
